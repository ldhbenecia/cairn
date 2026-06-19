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
  stderrTail: string;
};

const CORE_ENTRY = app.isPackaged
  ? resolve(process.resourcesPath, 'core/bundle/index.js')
  : resolve(__dirname, '../../../core/dist/main.js');
const CAIRN_ROOT = app.isPackaged
  ? (process.env.CAIRN_HOME ?? join(homedir(), '.cairn'))
  : resolve(__dirname, '../../../..');
const LOGS_DIR = join(homedir(), '.cairn', 'logs');

const STDERR_TAIL_LINES = 20;
const NOTION_URL_REGEX = /https:\/\/www\.notion\.so\/\S+/g;
const NO_ACTIVITY_REGEX = /no activity collected/i;
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
    const day = new Date().toISOString().slice(0, 10);
    appendFileSync(
      join(LOGS_DIR, `desktop-run.${day}.log`),
      `${new Date().toISOString()} [${mode}] [${level}] ${line}\n`,
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
  running.kill('SIGTERM');
  return true;
}
// 리로드/재부착 대비 — 진행 중 run 의 시작 시각·단계, 직전 완료 결과를 메인이 보관.
let runStartedAt = 0;
let runStep: RunStep = 'boot';
let lastResult: { mode: CoreMode; result: CoreResult; endedAt: number } | null = null;

export function isRunning(): boolean {
  return running !== null;
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
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
  lastResult: { mode: CoreMode; result: CoreResult; endedAt: number } | null;
};

export function runSnapshot(): RunSnapshot {
  return {
    busy: running !== null,
    mode: runningMode,
    step: runStep,
    startedAt: runStartedAt,
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

  // 전체 윈도우로 브로드캐스트 — 발행 도중 리로드해도 새 webContents 가 진행을 이어받게.
  const emit = (level: 'info' | 'err' | 'meta', line: string): void => {
    const clean = stripAnsi(line);
    appendRunLog(mode, level, clean);
    broadcast('cairn:run-line', { mode, level, line: clean });
  };

  runStartedAt = Date.now();
  runStep = 'boot';
  lastResult = null;
  cancelRequested = false;
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
  let noActivity = false;

  child.stdout?.on('data', (buf: Buffer) => {
    const text = stripAnsi(buf.toString('utf8'));
    stdoutAll += text;
    if (NO_ACTIVITY_REGEX.test(text)) noActivity = true;
    for (const line of text.split('\n')) {
      if (line.length === 0) continue;
      stdoutLines.push(line);
      emit('info', line);
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
        stderrTail: tail,
      };
      const outcome = result.ok ? (finalNoActivity ? 'no-activity' : 'ok') : 'fail';
      trackPublish(mode, outcome);
      // 취소 시에는 완료 알림을 띄우지 않는다.
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
      resolvePromise(result);
    });
    child.on('error', (err) => {
      running = null;
      runningMode = null;
      broadcastBusy();
      cancelRequested = false;
      emit('err', `[error] ${err.message}`);
      const failResult: CoreResult = {
        ok: false,
        exitCode: null,
        notionUrl: null,
        publishKind: null,
        publishPageId: null,
        noActivity: false,
        cancelled: false,
        stderrTail: err.message,
      };
      broadcastRunDone(mode, failResult);
      resolvePromise(failResult);
    });
  });
}
