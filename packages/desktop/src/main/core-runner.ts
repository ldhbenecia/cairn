import { app, BrowserWindow } from 'electron';
import { fork, type ChildProcess } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeEnv } from './claude-path';
import { syncWorklogToFolder } from './export';
import { sendResultNotification } from './notifier';
import { readSettings, type Settings } from './settings';
import { trackPublish } from './telemetry';

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
  noActivity: boolean;
  cancelled: boolean;
  summaryFailed: boolean;
  stderrTail: string;
};

const CORE_ENTRY = app.isPackaged
  ? resolve(process.resourcesPath, 'core/bundle/index.js')
  : resolve(__dirname, '../../../core/dist/main.js');
const CAIRN_ROOT = app.isPackaged
  ? (process.env.CAIRN_HOME ?? join(homedir(), '.cairn'))
  : resolve(__dirname, '../../../..');
const LOGS_DIR = join(CAIRN_ROOT, 'logs');

const STDERR_TAIL_LINES = 20;
const NOTION_URL_REGEX = /https:\/\/www\.notion\.so\/\S+/g;
const NO_ACTIVITY_REGEX = /no activity collected/i;
const SUMMARY_FAILED_REGEX = /summary generation failed|요약 생성 실패|summarizer threw/;
const PUBLISH_KIND_REGEX = /"kind"\s*:\s*"(created|recreated|skipped|no-target)"/g;
const PAGE_ID_REGEX = /"pageId"\s*:\s*"([0-9a-f-]{32,36})"/g;
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

const STEP_ORDER: RunStep[] = ['boot', 'collect', 'summarize', 'publish', 'done'];
const STEP_TRIGGERS: { regex: RegExp; step: RunStep }[] = [
  { regex: /Starting Nest application/, step: 'boot' },
  { regex: /(github|notion|local-git) collect/i, step: 'collect' },
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

// 백필 배치 진행 — 전체 stdout 스트림 기준 누적(렌더러 200줄 tail 제한에 영향받지 않게)
export type DateStep = 'collect' | 'summarize' | 'publish';
export type DateCounts = { pr: number; commit: number };
export type RunProgress = {
  total: number;
  done: number;
  active: number;
  dates: string[];
  doneDates: string[];
  stepByDate: Record<string, DateStep>;
  countsByDate: Record<string, DateCounts>;
};
let runProgress: RunProgress | null = null;
let bfTotal = 0;
let bfDone = 0;
let bfStarted = 0;
let bfInStat = false;
let bfLastKey = '';
let bfDates: string[] = [];
let bfDoneDates: string[] = [];
let bfStepByDate: Record<string, DateStep> = {};
let bfStepBlock: { date?: string; step?: DateStep } | null = null;
let bfCountsByDate: Record<string, DateCounts> = {};
let bfCountBlock: { date?: string; pr?: number; commit?: number; noActivity?: boolean } | null =
  null;

function resetBackfillTracking(): void {
  runProgress = null;
  bfTotal = 0;
  bfDone = 0;
  bfStarted = 0;
  bfInStat = false;
  bfLastKey = '';
  bfDates = [];
  bfDoneDates = [];
  bfStepByDate = {};
  bfStepBlock = null;
  bfCountsByDate = {};
  bfCountBlock = null;
}

// 'backfill date step' 블록에서 날짜별 단계(수집/요약/발행) 추출 — JSON 한 줄·pino-pretty 멀티라인 모두 대응
function trackDateStep(line: string): void {
  if (/backfill date step/.test(line)) {
    const dOne = /"date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/.exec(line);
    const sOne = /"step"\s*:\s*"(collect|summarize|publish)"/.exec(line);
    if (dOne && sOne) {
      bfStepByDate = { ...bfStepByDate, [dOne[1]!]: sOne[1] as DateStep };
      bfStepBlock = null;
    } else {
      bfStepBlock = {};
    }
    return;
  }
  if (!bfStepBlock) return;
  if (/^\[\d{2}:\d{2}:\d{2}/.test(line) || /"msg"\s*:/.test(line)) {
    bfStepBlock = null;
    return;
  }
  const d = /date["':\s]+["']?(\d{4}-\d{2}-\d{2})/.exec(line);
  const s = /step["':\s]+["']?(collect|summarize|publish)/.exec(line);
  if (d) bfStepBlock.date = d[1];
  if (s) bfStepBlock.step = s[1] as DateStep;
  if (bfStepBlock.date && bfStepBlock.step) {
    bfStepByDate = { ...bfStepByDate, [bfStepBlock.date]: bfStepBlock.step };
    bfStepBlock = null;
  }
}

// 날짜별 수집 수치(PR·커밋) 추출 — 'daily: publish done'(date+prCount+commitCountTotal),
// 'no activity collected'(0/0). JSON 한 줄·pino-pretty 멀티라인 블록 모두 대응.
function flushCountBlock(): void {
  const b = bfCountBlock;
  if (!b?.date) return;
  if (b.noActivity) {
    bfCountsByDate = { ...bfCountsByDate, [b.date]: { pr: 0, commit: 0 } };
    bfCountBlock = null;
  } else if (b.pr !== undefined && b.commit !== undefined) {
    bfCountsByDate = { ...bfCountsByDate, [b.date]: { pr: b.pr, commit: b.commit } };
    bfCountBlock = null;
  }
}

function trackDateCounts(line: string): void {
  const isDone = /daily: publish done/.test(line);
  const isNoActivity = /no activity collected/.test(line);
  if (isDone || isNoActivity) {
    const d = /date["':\s]+["']?(\d{4}-\d{2}-\d{2})/.exec(line);
    const p = /prCount["':\s]+(\d+)/.exec(line);
    const c = /commitCountTotal["':\s]+(\d+)/.exec(line);
    bfCountBlock = {
      date: d?.[1],
      pr: isNoActivity ? 0 : p ? Number(p[1]) : undefined,
      commit: isNoActivity ? 0 : c ? Number(c[1]) : undefined,
      noActivity: isNoActivity,
    };
    flushCountBlock();
    return;
  }
  if (!bfCountBlock) return;
  if (/^\[\d{2}:\d{2}:\d{2}/.test(line) || /"msg"\s*:/.test(line)) {
    bfCountBlock = null;
    return;
  }
  const d = /date["':\s]+["']?(\d{4}-\d{2}-\d{2})/.exec(line);
  const p = /prCount["':\s]+(\d+)/.exec(line);
  const c = /commitCountTotal["':\s]+(\d+)/.exec(line);
  if (d) bfCountBlock.date = d[1];
  if (p && !bfCountBlock.noActivity) bfCountBlock.pr = Number(p[1]);
  if (c && !bfCountBlock.noActivity) bfCountBlock.commit = Number(c[1]);
  flushCountBlock();
}

// pino-pretty 멀티라인 대응: 헤더(`[HH:MM:SS]`) 기준 블록으로 total/done 누적, date start 수로 동시 처리 산정
function trackBackfill(line: string, mode: CoreMode): void {
  if (line.includes('backfill date start')) bfStarted += 1;
  trackDateStep(line);
  trackDateCounts(line);
  // 배치 시작 시 1회 찍히는 날짜 목록(쉼표 join) — 헤더/블록 어느 라인에 있어도 잡히게 무조건 검사
  // 음수 lookbehind 로 'doneDates' 는 제외(전체 대상 목록만)
  const mDates = /(?<![a-zA-Z])dates["':\s]+["']?([\d,-]+)/.exec(line);
  if (mDates?.[1]) {
    const parsed = mDates[1].split(',').filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (parsed.length > bfDates.length) bfDates = parsed;
  }
  // 완료된 날짜 누적 목록 — 동시 완료 순서가 날짜 순서와 달라도 UI 가 멤버십으로 상태 판정
  const mDone = /doneDates["':\s]+["']?([\d,-]+)/.exec(line);
  if (mDone?.[1]) {
    const parsed = mDone[1].split(',').filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (parsed.length >= bfDoneDates.length) bfDoneDates = parsed;
  }
  const isHeader = /^\[\d{2}:\d{2}:\d{2}/.test(line) || /"msg"\s*:/.test(line);
  if (isHeader) bfInStat = /backfill batch start|backfill progress/.test(line);
  else if (/backfill batch start|backfill progress/.test(line)) bfInStat = true;
  if (bfInStat) {
    const mt = /total["':\s]+(\d+)/.exec(line);
    const md = /done["':\s]+(\d+)/.exec(line);
    if (mt) bfTotal = Math.max(bfTotal, Number(mt[1]));
    if (md) bfDone = Math.max(bfDone, Number(md[1]));
  }
  if (bfTotal <= 1) return;
  const active = Math.max(0, Math.min(bfTotal - bfDone, bfStarted - bfDone));
  const stepSig = Object.entries(bfStepByDate)
    .map(([d, s]) => `${d}:${s}`)
    .sort()
    .join(',');
  const countSig = Object.entries(bfCountsByDate)
    .map(([d, v]) => `${d}:${v.pr}:${v.commit}`)
    .sort()
    .join(',');
  const key = `${bfDone}/${bfTotal}/${active}/${bfDates.length}/${bfDoneDates.length}/${stepSig}/${countSig}`;
  if (key === bfLastKey) return;
  bfLastKey = key;
  runProgress = {
    total: bfTotal,
    done: bfDone,
    active,
    dates: bfDates,
    doneDates: bfDoneDates,
    stepByDate: bfStepByDate,
    countsByDate: bfCountsByDate,
  };
  broadcast('cairn:run-progress', { mode, ...runProgress });
}

export function isRunning(): boolean {
  return running !== null;
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    win.webContents.send(channel, payload);
  }
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
    progress: runProgress,
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

export async function runCore(mode: CoreMode, options: CoreRunOptions = {}): Promise<CoreResult> {
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
    child.on('close', (exitCode) => {
      running = null;
      runningMode = null;
      broadcastBusy();
      resetBackfillTracking();
      const tailSource = stderrLines.length > 0 ? stderrLines : stdoutLines;
      const tail = tailSource.slice(-STDERR_TAIL_LINES).join('\n');
      const urlMatches = stdoutAll.match(NOTION_URL_REGEX) ?? [];
      const lastUrl = urlMatches.at(-1)?.replace(/["',}\]]+$/, '') ?? null;
      const kindMatches = [...stdoutAll.matchAll(PUBLISH_KIND_REGEX)];
      const lastKind = (kindMatches.at(-1)?.[1] as PublishKind) ?? null;
      const pageIdMatches = [...stdoutAll.matchAll(PAGE_ID_REGEX)];
      const lastPageId = pageIdMatches.at(-1)?.[1] ?? null;
      const finalNoActivity = noActivity && !lastKind && !lastUrl && !lastPageId;
      const cancelled = cancelRequested;
      cancelRequested = false;
      emit('meta', `[exit] code=${exitCode ?? 'null'}${cancelled ? ' (cancelled)' : ''}`);
      if (exitCode === 0) emitStep('done');
      const result: CoreResult = {
        ok: exitCode === 0,
        exitCode,
        notionUrl: lastUrl,
        publishKind: lastKind,
        publishPageId: lastPageId,
        noActivity: finalNoActivity,
        cancelled,
        summaryFailed: SUMMARY_FAILED_REGEX.test(stdoutAll),
        stderrTail: tail,
      };
      try {
        const outcome = result.ok ? (finalNoActivity ? 'no-activity' : 'ok') : 'fail';
        trackPublish(mode, outcome);
        if (!cancelled) sendResultNotification(mode, result);
        if (!cancelled && result.ok && lastPageId && !finalNoActivity) {
          const pad = (n: number): string => String(n).padStart(2, '0');
          const d = new Date();
          const localDate =
            options.date ?? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          const fileBase = mode === 'daily' ? localDate : `${localDate}-${mode}`;
          void syncWorklogToFolder({
            pageId: lastPageId,
            fileBase,
            title: fileBase,
            date: localDate,
          }).catch((err: unknown) => {
            emit('err', `[export] sync 실패: ${err instanceof Error ? err.message : String(err)}`);
          });
        }
        broadcastRunDone(mode, result);
      } finally {
        resolvePromise(result);
      }
    });
    child.on('error', (err) => {
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
        noActivity: false,
        cancelled: false,
        summaryFailed: false,
        stderrTail: err.message,
      };
      // spawn 실패(ENOENT 등)도 완료 알림을 띄운다 — close 가 안 오는 경로라 누락됐었음
      sendResultNotification(mode, failResult);
      broadcastRunDone(mode, failResult);
      resolvePromise(failResult);
    });
  });
}
