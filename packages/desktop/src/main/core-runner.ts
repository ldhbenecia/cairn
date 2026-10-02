import { app } from 'electron';
import { fork, type ChildProcess } from 'node:child_process';
import {
  appendFileSync,
  createWriteStream,
  mkdirSync,
  readdirSync,
  unlinkSync,
  type WriteStream,
} from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyBackfillEvent,
  getBackfillCountsByDate,
  getBackfillLastPublishedDate,
  getBackfillPagesByDate,
  getRunProgress,
  resetBackfillTracking,
} from './core-runner-backfill';
import { broadcast } from './broadcast';
import { errorMessage } from './error-message';
import { claudeEnv, claudePathReady } from './claude-path';
import { localTodayIso } from './auto-publish-schedule';
import { pool } from '../shared/pool';
import { syncWorklogToFolder } from './export';
import { buildExportTargets, type ExportTarget } from './export-targets';
import { sendResultNotification } from './notifier';
import { syncStats } from './cloud-sync';
import { scheduleJournalBackup } from './journal-git-backup';
import { readSettings, type Settings } from './settings';
import { envWithoutSecrets, secretEnv } from './secret-store';
import { CAIRN_ROOT } from './setup';
import { trackPublish, type PublishTrigger } from './telemetry';
import {
  applyParentEvent,
  createExtractor,
  deriveFailureHint,
  parseParentEvent,
  type RunStep,
} from './core-runner-extract';
import type { CoreMode, CoreRunOptions, CoreResult, RunSnapshot } from '../shared/ipc-types';
export type { CoreMode, CoreRunOptions, CoreResult, RunSnapshot } from '../shared/ipc-types';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

export type { FailureHint, PublishKind, RunStep } from './core-runner-extract';

export const CORE_ENTRY = app.isPackaged
  ? resolve(process.resourcesPath, 'core/bundle/index.js')
  : resolve(__dirname, '../../../core/dist/main.js');
const LOGS_DIR = join(CAIRN_ROOT, 'logs');

const STDERR_TAIL_LINES = 20;
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

const STEP_ORDER: RunStep[] = ['boot', 'collect', 'summarize', 'publish', 'done'];
const STEP_TRIGGERS: { regex: RegExp; step: RunStep }[] = [
  { regex: /Starting Nest application/, step: 'boot' },
  { regex: /(github|notion|local-git|rollup) collect/i, step: 'collect' },
  { regex: /summarizer (start|finished)|DailySummarizerService/i, step: 'summarize' },
  {
    regex: /notion publish start|worklog page (created|already exists)|publish done/i,
    step: 'publish',
  },
  { regex: /orchestrator\.run done/, step: 'done' },
];

function stripAnsi(s: string): string {
  return s.replace(ANSI_REGEX, '');
}

// 라인마다 동기 appendFileSync 면 백필 수천 라인에서 메인 이벤트 루프가 블로킹됨
// — run 당 WriteStream 하나로 비동기 버퍼 write
let runLogStream: WriteStream | null = null;

const LOG_RETENTION_DAYS = 30;

// 실행 시작마다 30일 지난 날짜별 로그 정리
function pruneOldRunLogs(): void {
  try {
    const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const name of readdirSync(LOGS_DIR)) {
      const m = /^desktop-run\.(\d{4}-\d{2}-\d{2})\.log$/.exec(name);
      if (!m) continue;
      const [y, mo, d] = m[1]!.split('-').map(Number);
      if (new Date(y!, mo! - 1, d).getTime() < cutoff) unlinkSync(join(LOGS_DIR, name));
    }
  } catch {
    // best-effort
  }
}

function runLogPath(): string {
  return join(LOGS_DIR, `desktop-run.${localTodayIso(new Date())}.log`);
}

function openRunLog(): void {
  closeRunLog();
  try {
    mkdirSync(LOGS_DIR, { recursive: true, mode: 0o700 });
    pruneOldRunLogs();
    // 로그엔 절대경로·커밋 제목 등이 그대로 담김 — 시크릿 파일들(0600)과 같은 수준으로 잠금
    const stream = createWriteStream(runLogPath(), {
      flags: 'a',
      mode: 0o600,
    });
    stream.on('error', () => closeRunLog()); // 디스크 오류 등 — 로깅은 best-effort
    runLogStream = stream;
  } catch {
    runLogStream = null;
  }
}

function closeRunLog(): void {
  if (runLogStream) {
    runLogStream.end();
    runLogStream = null;
  }
}

// run 밖 fork(probe·기간 정리 문서)는 스트림이 없어 한 줄씩 동기 append
export function appendSideLog(tag: string, level: 'info' | 'err' | 'meta', line: string): void {
  try {
    mkdirSync(LOGS_DIR, { recursive: true, mode: 0o700 });
    appendFileSync(
      runLogPath(),
      `${new Date().toISOString()} [${tag}] [${level}] ${stripAnsi(line)}\n`,
      { mode: 0o600 },
    );
  } catch {
    // best-effort
  }
}

function appendRunLog(mode: CoreMode, level: 'info' | 'err' | 'meta', line: string): void {
  if (!runLogStream) return;
  runLogStream.write(`${new Date().toISOString()} [${mode}] [${level}] ${line}\n`);
}

function detectStep(line: string): RunStep | null {
  for (const { regex, step } of STEP_TRIGGERS) {
    if (regex.test(line)) return step;
  }
  return null;
}

function stepRank(step: RunStep): number {
  return STEP_ORDER.indexOf(step);
}

const PROMPT_MODES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

function promptEnv(prompts: Settings['prompts']): Record<string, string> {
  const env: Record<string, string> = {};
  for (const m of PROMPT_MODES) {
    const prompt = prompts[m];
    if (prompt?.trim()) env[`CAIRN_PROMPT_${m.toUpperCase()}`] = prompt;
  }
  return env;
}

// 자식 core env 조립 — 토큰은 발행 run(secrets)에만, 메인 process.env 에 올라간 시크릿 키는 그 외 fork 에서 제거
export function coreChildEnv(
  settings: Settings,
  opts: { secrets: boolean; prompts?: boolean },
): NodeJS.ProcessEnv {
  return {
    ...(opts.secrets ? { ...process.env, ...secretEnv() } : envWithoutSecrets()),
    NODE_ENV: app.isPackaged ? 'production' : (process.env.NODE_ENV ?? 'development'),
    CAIRN_PACKAGED: app.isPackaged ? 'true' : 'false',
    ...claudeEnv(),
    ...(opts.prompts ? promptEnv(settings.prompts) : {}),
    ...(settings.summaryModel !== 'default' ? { CAIRN_SUMMARY_MODEL: settings.summaryModel } : {}),
  };
}

let running: ChildProcess | null = null;
let runningMode: CoreMode | null = null;
let cancelRequested = false;

export function cancelRun(): boolean {
  if (!running) return false;
  cancelRequested = true;
  const child = running;
  child.kill('SIGTERM');
  setTimeout(() => {
    if (running === child) child.kill('SIGKILL');
  }, 5000);
  return true;
}

export function killRunning(): void {
  if (!running) return;
  // cancelRequested 를 세워야 exit 핸들러가 이 강제 종료를 실패로 오인해 실패 알림·telemetry fail 을 안 냄
  cancelRequested = true;
  running.kill('SIGKILL');
}
// 리로드·재부착 대비 — 진행 중 run 의 시작 시각·단계와 직전 완료 결과를 메인이 보관
let runStartedAt = 0;
let runStep: RunStep = 'boot';
let lastResult: { mode: CoreMode; result: CoreResult; endedAt: number } | null = null;

export function isRunning(): boolean {
  return running !== null;
}

function broadcastBusy(): void {
  broadcast('cairn:busy', busyState());
}

export function busyState(): { busy: boolean; mode: CoreMode | null } {
  return { busy: running !== null, mode: runningMode };
}

export function runSnapshot(): RunSnapshot {
  return {
    busy: running !== null,
    mode: runningMode,
    step: runStep,
    startedAt: runStartedAt,
    progress: getRunProgress(),
    lastResult,
  };
}

function broadcastRunDone(mode: CoreMode, result: CoreResult): void {
  lastResult = { mode, result, endedAt: Date.now() };
  broadcast('cairn:run-done', { mode, result });
}

export async function probeClaude(): Promise<{ ok: boolean }> {
  await claudePathReady();
  return new Promise((resolvePromise) => {
    const child = fork(CORE_ENTRY, ['--probe-claude'], {
      cwd: CAIRN_ROOT,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      // probe 는 Claude 상태만 확인 — GitHub·Notion 토큰 미전달 (최소 권한)
      env: coreChildEnv(readSettings(), { secrets: false }),
    });
    let out = '';
    child.stdout?.on('data', (b: Buffer) => (out += b.toString('utf8')));
    const timer = setTimeout(() => child.kill(), 60_000);
    let settled = false;
    const finish = (ok: boolean, detail: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      appendSideLog('probe', ok ? 'meta' : 'err', detail);
      resolvePromise({ ok });
    };
    child.on('close', () => {
      const line = out.split('\n').find((l) => l.startsWith('CLAUDE_')) ?? '';
      finish(line === 'CLAUDE_OK', line || 'no probe output');
    });
    child.on('error', (err) => finish(false, errorMessage(err)));
  });
}

export async function runCore(
  mode: CoreMode,
  options: CoreRunOptions = {},
  trigger: PublishTrigger = 'manual',
): Promise<CoreResult> {
  // busy 확인 전에 await — 이후 fork·running 대입까지 동기라 동시 호출이 둘 다 통과하지 않음
  await claudePathReady();
  // 코드화된 에러 — 렌더러가 i18n 으로 매핑 (영어 사용자에게 한국어 노출 방지)
  if (running) throw new Error(`busy:${runningMode ?? mode}`);

  // 전체 윈도우로 브로드캐스트 — 발행 중 리로드해도 새 webContents 가 진행을 이어받음
  const emit = (level: 'info' | 'err' | 'meta', line: string): void => {
    const clean = stripAnsi(line);
    appendRunLog(mode, level, clean);
    broadcast('cairn:run-line', { mode, level, line: clean });
  };

  runStartedAt = Date.now();
  runStep = 'boot';
  lastResult = null;
  cancelRequested = false;
  resetBackfillTracking();
  openRunLog();
  const emitStep = (step: RunStep): void => {
    if (stepRank(step) <= stepRank(runStep)) return;
    runStep = step;
    broadcast('cairn:run-step', { mode, step });
  };
  broadcast('cairn:run-step', { mode, step: runStep });

  const settings = readSettings();
  const args = [`--mode=${mode}`];
  if (options.backfillDays !== undefined) args.push(`--backfill-days=${options.backfillDays}`);
  if (options.force) args.push('--force');
  if (options.date) args.push(`--date=${options.date}`);
  if (options.skipNotion) args.push('--skip-notion');
  args.push(`--lang=${settings.language}`);

  emit('meta', `[fork] ${CORE_ENTRY} ${args.join(' ')}`);
  emit('meta', `[cwd] ${CAIRN_ROOT}`);

  const child = fork(CORE_ENTRY, args, {
    cwd: CAIRN_ROOT,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    // 암호화 스토어의 토큰을 자식 env 로 — .env 이관·삭제 뒤에도 core 동작
    env: coreChildEnv(settings, { secrets: true, prompts: true }),
  });
  running = child;
  runningMode = mode;
  broadcastBusy();
  emit('meta', `[fork] pid=${child.pid ?? '?'}`);

  // 전체 stdout 을 쌓아 종료 시 스캔하면 장기 백필에서 수 MB 누적·종료 블로킹 —
  // 완결된 라인마다 증분 추출, tail 버퍼는 최근 STDERR_TAIL_LINES 만 링으로 보존
  const stderrLines: string[] = [];
  const stdoutLines: string[] = [];
  let stdoutCarry = '';
  const ext = createExtractor();

  const pushTail = (buf: string[], line: string): void => {
    buf.push(line);
    if (buf.length > STDERR_TAIL_LINES) buf.shift();
  };

  // 청크 경계에서 멀티바이트(한글)가 잘리면 toString 이 U+FFFD 로 만들어 정규식 매칭까지 실패
  // — StringDecoder 로 경계 보존
  const outDecoder = new StringDecoder('utf8');
  const errDecoder = new StringDecoder('utf8');

  child.stdout?.on('data', (buf: Buffer) => {
    const lines = (stdoutCarry + stripAnsi(outDecoder.write(buf))).split('\n');
    stdoutCarry = lines.pop() ?? '';
    for (const line of lines) {
      if (line.length === 0) continue;
      ext.feed(line);
      pushTail(stdoutLines, line);
      emit('info', line);
      const step = detectStep(line);
      if (step) emitStep(step);
    }
  });
  child.stderr?.on('data', (buf: Buffer) => {
    for (const line of stripAnsi(errDecoder.write(buf)).split('\n')) {
      if (line.length === 0) continue;
      pushTail(stderrLines, line);
      emit('err', line);
    }
  });

  // 구조화 이벤트가 결과·배치 진행의 단일 소스 (stdout 은 failureHint·step 표시만)
  child.on('message', (raw) => {
    const event = parseParentEvent(raw);
    if (!event) return;
    const step = applyParentEvent(ext, event);
    if (step) emitStep(step);
    applyBackfillEvent(event, mode);
  });

  return new Promise<CoreResult>((resolvePromise) => {
    // 'error' 후에도 'close' 가 또 올 수 있음 — 완료 처리(알림·텔레메트리·run-done)는 1회만
    let settled = false;
    child.on('close', (exitCode) => {
      if (settled) return;
      settled = true;
      running = null;
      runningMode = null;
      broadcastBusy();
      let exportPending = false;
      // stdout 이 \n 없이 끝나면 마지막 조각이 carry 에 남아 종료 시 반영
      if (stdoutCarry.length > 0) ext.feed(stdoutCarry);
      const tailSource = stderrLines.length > 0 ? stderrLines : stdoutLines;
      const tail = tailSource.slice(-STDERR_TAIL_LINES).join('\n');
      const lastUrl = ext.lastUrl;
      const lastKind = ext.lastKind;
      const lastPageId = ext.lastPageId;
      const lastJournalFile = ext.lastJournalFile;
      const finalNoActivity = ext.noActivity && !lastKind && !lastUrl && !lastPageId;
      const cancelled = cancelRequested;
      cancelRequested = false;
      emit('meta', `[exit] code=${exitCode ?? 'null'}${cancelled ? ' (cancelled)' : ''}`);
      if (exitCode === 0) emitStep('done');
      // totals·발행 날짜는 reset 전에 스냅샷 — reset 먼저면 항상 0/null
      const countsByDate = getBackfillCountsByDate();
      const totals = Object.values(countsByDate).reduce(
        (a, c) => ({ pr: a.pr + c.pr, commit: a.commit + c.commit }),
        { pr: 0, commit: 0 },
      );
      const lastPublishedDate = getBackfillLastPublishedDate();
      const publishedPages = getBackfillPagesByDate();
      const finalProgress = getRunProgress();
      resetBackfillTracking();
      // 배치 일부 날짜의 요약 실패를 전체 실패로 표시하지 않음 — 전 날짜 실패일 때만 유지
      const batchTotal = finalProgress?.total ?? 0;
      const summaryFailed =
        ext.summaryFailed &&
        (batchTotal <= 1 || (finalProgress?.failedDates.length ?? 0) >= batchTotal);
      const result: CoreResult = {
        ok: exitCode === 0,
        exitCode,
        notionUrl: lastUrl,
        publishKind: lastKind,
        // 노션 미연동(로컬 전용) 발행도 앱 내 "일지 보기"가 로컬 일지를 열도록 journal id 로 폴백
        publishPageId: lastPageId ?? (lastJournalFile ? `journal:${lastJournalFile}` : null),
        journalFile: lastJournalFile,
        noActivity: finalNoActivity,
        cancelled,
        summaryFailed,
        failureHint: exitCode === 0 ? null : ext.failureHint,
        journalWriteFailed: ext.journalWriteFailed,
        collectPartial: ext.collectPartialLabels,
        prCount: totals.pr,
        commitCount: totals.commit,
        stderrTail: tail,
      };
      try {
        const outcome = result.ok ? (finalNoActivity ? 'no-activity' : 'ok') : 'fail';
        trackPublish(mode, outcome, {
          trigger,
          summaryFailed: result.summaryFailed,
          backfillDays: options.backfillDays,
        });
        if (!cancelled) sendResultNotification(mode, result);
        // 발행 직후 stats 를 클라우드로 — 6시간 주기만으로는 다른 기기 칩 반영이 늦음
        if (!cancelled && result.ok) void syncStats();
        if (!cancelled && result.ok && !finalNoActivity) {
          // 백필 catch-up 으로 오늘이 아닌 날이 발행됐을 수 있어 실제 발행 날짜 우선
          const fallbackDate = options.date ?? lastPublishedDate ?? localTodayIso(new Date());
          const targets = buildExportTargets({
            mode,
            fallbackDate,
            lastPageId,
            lastJournalFile,
            countsByDate,
            pagesByDate: publishedPages,
          });
          // 60일 백필이면 targets 60건 — 페이지마다 Notion fetch 라 동시성 4 로 제한해 레이트리밋 회피
          // 로그 스트림은 export 실패 라인까지 남도록 export 완료 후 close
          void runExportSync(targets, emit).finally(closeRunLog);
          exportPending = true;
          scheduleJournalBackup();
        }
        broadcastRunDone(mode, result);
      } finally {
        if (!exportPending) closeRunLog();
        resolvePromise(result);
      }
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      running = null;
      runningMode = null;
      broadcastBusy();
      cancelRequested = false;
      resetBackfillTracking();
      emit('err', `[error] ${err.message}`);
      const failResult: CoreResult = {
        ok: false,
        exitCode: null,
        notionUrl: null,
        publishKind: null,
        publishPageId: null,
        journalFile: null,
        noActivity: false,
        cancelled: false,
        summaryFailed: false,
        failureHint: deriveFailureHint(err.message),
        journalWriteFailed: false,
        collectPartial: [],
        prCount: 0,
        commitCount: 0,
        stderrTail: err.message,
      };
      // spawn 실패(ENOENT 등)는 close 가 안 오는 경로라 여기서 완료 알림
      trackPublish(mode, 'fail', {
        trigger,
        summaryFailed: false,
        backfillDays: options.backfillDays,
      });
      sendResultNotification(mode, failResult);
      broadcastRunDone(mode, failResult);
      closeRunLog();
      resolvePromise(failResult);
    });
  });
}

// targets 를 POOL 개씩만 병렬로, run 을 막지 않게 fire-and-forget
async function runExportSync(
  targets: ExportTarget[],
  emit: (level: 'err', line: string) => void,
): Promise<void> {
  await pool(targets, 4, async (t) => {
    try {
      await syncWorklogToFolder({
        category: t.category,
        date: t.date,
        fileBase: t.fileBase,
        title: t.fileBase,
        pageId: t.pageId,
      });
    } catch (err) {
      emit('err', `[export] sync 실패: ${errorMessage(err)}`);
    }
  });
}
