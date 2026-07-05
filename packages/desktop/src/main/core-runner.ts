import { app } from 'electron';
import { fork, type ChildProcess } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getBackfillCountsByDate,
  getBackfillLastPublishedDate,
  getBackfillPagesByDate,
  getRunProgress,
  resetBackfillTracking,
  trackBackfill,
  type RunProgress,
} from './core-runner-backfill';
import { broadcast } from './broadcast';
import { errorMessage } from './error-message';
import { claudeEnv } from './claude-path';
import { syncWorklogToFolder } from './export';
import { sendResultNotification } from './notifier';
import { readSettings, type Settings } from './settings';
import { CAIRN_ROOT } from './setup';
import { trackPublish, type PublishTrigger } from './telemetry';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

export type CoreMode = 'daily' | 'weekly' | 'monthly';

export type CoreRunOptions = {
  backfillDays?: number;
  force?: boolean;
  date?: string; // "YYYY-MM-DD" — 미지정 시 엔진이 로컬 today 사용 (롤업 기간 anchor 등)
};

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

export type RunStep = 'boot' | 'collect' | 'summarize' | 'publish' | 'done';

export type CoreResult = {
  ok: boolean;
  exitCode: number | null;
  notionUrl: string | null;
  publishKind: PublishKind;
  publishPageId: string | null;
  journalFile: string | null;
  noActivity: boolean;
  cancelled: boolean;
  summaryFailed: boolean;
  prCount: number;
  commitCount: number;
  stderrTail: string;
};

const CORE_ENTRY = app.isPackaged
  ? resolve(process.resourcesPath, 'core/bundle/index.js')
  : resolve(__dirname, '../../../core/dist/main.js');
const LOGS_DIR = join(CAIRN_ROOT, 'logs');

const STDERR_TAIL_LINES = 20;
const NOTION_URL_REGEX = /https:\/\/www\.notion\.so\/\S+/g;
const NO_ACTIVITY_REGEX = /no activity collected/i;
const SUMMARY_FAILED_REGEX = /summary generation failed|요약 생성 실패|summarizer threw/;
const PUBLISH_KIND_REGEX = /"kind"\s*:\s*"(created|recreated|skipped|no-target)"/g;
const PAGE_ID_REGEX = /"pageId"\s*:\s*"([0-9a-f-]{32,36})"/g;
// 같은 로그 라인 안이면 키 순서 무관하게 fileName 추출
const JOURNAL_FILE_REGEX = /^(?=.*journal write done).*"fileName"\s*:\s*"([^"]+\.md)"/gm;
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

function appendRunLog(mode: CoreMode, level: 'info' | 'err' | 'meta', line: string): void {
  try {
    mkdirSync(LOGS_DIR, { recursive: true });
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    appendFileSync(
      join(LOGS_DIR, `desktop-run.${day}.log`),
      `${now.toISOString()} [${mode}] [${level}] ${line}\n`,
      'utf8',
    );
  } catch {
    return;
  }
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

function promptEnv(prompts: Settings['prompts']): Record<string, string> {
  const env: Record<string, string> = {};
  if (prompts.daily?.trim()) env.CAIRN_PROMPT_DAILY = prompts.daily;
  if (prompts.weekly?.trim()) env.CAIRN_PROMPT_WEEKLY = prompts.weekly;
  if (prompts.monthly?.trim()) env.CAIRN_PROMPT_MONTHLY = prompts.monthly;
  return env;
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
  if (running) running.kill('SIGKILL');
}
// 리로드/재부착 대비 — 진행 중 run 의 시작 시각·단계, 직전 완료 결과를 메인이 보관
let runStartedAt = 0;
let runStep: RunStep = 'boot';
let lastResult: { mode: CoreMode; result: CoreResult; endedAt: number } | null = null;

export function isRunning(): boolean {
  return running !== null;
}

function broadcastBusy(): void {
  broadcast('cairn:busy', { busy: running !== null, mode: runningMode });
}

export function busyState(): { busy: boolean; mode: CoreMode | null } {
  return { busy: running !== null, mode: runningMode };
}

export type RunSnapshot = {
  busy: boolean;
  mode: CoreMode | null;
  step: RunStep;
  startedAt: number;
  progress: RunProgress | null;
  lastResult: { mode: CoreMode; result: CoreResult; endedAt: number } | null;
};

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
  return new Promise((resolvePromise) => {
    const child = fork(CORE_ENTRY, ['--probe-claude'], {
      cwd: CAIRN_ROOT,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, CAIRN_PACKAGED: app.isPackaged ? 'true' : 'false', ...claudeEnv() },
    });
    let out = '';
    child.stdout?.on('data', (b: Buffer) => (out += b.toString('utf8')));
    const timer = setTimeout(() => child.kill(), 60_000);
    child.on('close', () => {
      clearTimeout(timer);
      resolvePromise({ ok: out.includes('CLAUDE_OK') });
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolvePromise({ ok: false });
    });
  });
}

export async function runCore(
  mode: CoreMode,
  options: CoreRunOptions = {},
  trigger: PublishTrigger = 'manual',
): Promise<CoreResult> {
  // 코드화된 에러 — 렌더러가 i18n 으로 매핑 (영어 사용자에게 한국어 새는 것 방지)
  if (running) throw new Error(`busy:${runningMode ?? mode}`);

  // 전체 윈도우로 브로드캐스트 — 발행 도중 리로드해도 새 webContents 가 진행을 이어받게
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
  args.push(`--lang=${settings.language}`);

  emit('meta', `[fork] ${CORE_ENTRY} ${args.join(' ')}`);
  emit('meta', `[cwd] ${CAIRN_ROOT}`);

  const child = fork(CORE_ENTRY, args, {
    cwd: CAIRN_ROOT,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: {
      ...process.env,
      NODE_ENV: app.isPackaged ? 'production' : (process.env.NODE_ENV ?? 'development'),
      CAIRN_PACKAGED: app.isPackaged ? 'true' : 'false',
      ...claudeEnv(),
      ...promptEnv(settings.prompts),
      ...(settings.summaryModel !== 'default'
        ? { CAIRN_SUMMARY_MODEL: settings.summaryModel }
        : {}),
    },
  });
  running = child;
  runningMode = mode;
  broadcastBusy();
  emit('meta', `[fork] pid=${child.pid ?? '?'}`);

  const stderrLines: string[] = [];
  const stdoutLines: string[] = [];
  let stdoutAll = '';
  let stdoutCarry = '';
  let noActivity = false;

  child.stdout?.on('data', (buf: Buffer) => {
    const text = stripAnsi(buf.toString('utf8'));
    stdoutAll += text;
    if (NO_ACTIVITY_REGEX.test(text)) noActivity = true;
    const lines = (stdoutCarry + text).split('\n');
    stdoutCarry = lines.pop() ?? '';
    for (const line of lines) {
      if (line.length === 0) continue;
      stdoutLines.push(line);
      emit('info', line);
      trackBackfill(line, mode);
      const step = detectStep(line);
      if (step) emitStep(step);
    }
  });
  child.stderr?.on('data', (buf: Buffer) => {
    for (const line of stripAnsi(buf.toString('utf8')).split('\n')) {
      if (line.length === 0) continue;
      stderrLines.push(line);
      emit('err', line);
    }
  });

  return new Promise<CoreResult>((resolvePromise) => {
    // 'error' 후에도 'close' 가 또 올 수 있음(Node) — 완료 처리(알림·텔레메트리·run-done)는 1회만
    let settled = false;
    child.on('close', (exitCode) => {
      if (settled) return;
      settled = true;
      running = null;
      runningMode = null;
      broadcastBusy();
      const tailSource = stderrLines.length > 0 ? stderrLines : stdoutLines;
      const tail = tailSource.slice(-STDERR_TAIL_LINES).join('\n');
      const urlMatches = stdoutAll.match(NOTION_URL_REGEX) ?? [];
      const lastUrl = urlMatches.at(-1)?.replace(/["',}\]]+$/, '') ?? null;
      const kindMatches = [...stdoutAll.matchAll(PUBLISH_KIND_REGEX)];
      const lastKind = (kindMatches.at(-1)?.[1] as PublishKind) ?? null;
      const pageIdMatches = [...stdoutAll.matchAll(PAGE_ID_REGEX)];
      const lastPageId = pageIdMatches.at(-1)?.[1] ?? null;
      const journalMatches = [...stdoutAll.matchAll(JOURNAL_FILE_REGEX)];
      const lastJournalFile = journalMatches.at(-1)?.[1] ?? null;
      const finalNoActivity = noActivity && !lastKind && !lastUrl && !lastPageId;
      const cancelled = cancelRequested;
      cancelRequested = false;
      emit('meta', `[exit] code=${exitCode ?? 'null'}${cancelled ? ' (cancelled)' : ''}`);
      if (exitCode === 0) emitStep('done');
      // totals·발행 날짜는 reset 전에 스냅샷 — reset 을 먼저 하면 항상 0/null 이 된다
      const totals = Object.values(getBackfillCountsByDate()).reduce(
        (a, c) => ({ pr: a.pr + c.pr, commit: a.commit + c.commit }),
        { pr: 0, commit: 0 },
      );
      const lastPublishedDate = getBackfillLastPublishedDate();
      const publishedPages = getBackfillPagesByDate();
      resetBackfillTracking();
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
        summaryFailed: SUMMARY_FAILED_REGEX.test(stdoutAll),
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
        if (!cancelled && result.ok && !finalNoActivity) {
          const pad = (n: number): string => String(n).padStart(2, '0');
          const d = new Date();
          // 백필 catch-up 으로 오늘이 아닌 날이 발행됐을 수 있음 — 실제 발행된 날짜를 우선
          const fallbackDate =
            options.date ??
            lastPublishedDate ??
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          // daily 백필 다건이면 발행된 날짜 전부 sync (기존엔 마지막 페이지만 나가던 문제)
          const targets =
            mode === 'daily' && Object.keys(publishedPages).length > 0
              ? Object.entries(publishedPages).map(([date, pageId]) => ({
                  pageId,
                  fileBase: date,
                  date,
                }))
              : lastPageId
                ? [
                    {
                      pageId: lastPageId,
                      fileBase: mode === 'daily' ? fallbackDate : `${fallbackDate}-${mode}`,
                      date: fallbackDate,
                    },
                  ]
                : [];
          for (const t of targets) {
            void syncWorklogToFolder({
              pageId: t.pageId,
              fileBase: t.fileBase,
              title: t.fileBase,
              date: t.date,
            }).catch((err: unknown) => {
              emit('err', `[export] sync 실패: ${errorMessage(err)}`);
            });
          }
        }
        broadcastRunDone(mode, result);
      } finally {
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
        prCount: 0,
        commitCount: 0,
        stderrTail: err.message,
      };
      // spawn 실패(ENOENT 등)도 완료 알림을 띄운다 — close 가 안 오는 경로라 누락됐었음
      trackPublish(mode, 'fail', {
        trigger,
        summaryFailed: false,
        backfillDays: options.backfillDays,
      });
      sendResultNotification(mode, failResult);
      broadcastRunDone(mode, failResult);
      resolvePromise(failResult);
    });
  });
}
