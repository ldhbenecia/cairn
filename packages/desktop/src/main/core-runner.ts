import { app, type WebContents } from 'electron';
import { fork, type ChildProcess } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeEnv } from './claude-path';
import { sendResultNotification } from './notifier';
import { readSettings } from './settings';
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
  stderrTail: string;
};

const CORE_ENTRY = app.isPackaged
  ? resolve(process.resourcesPath, 'core/bundle/index.js')
  : resolve(__dirname, '../../../core/dist/main.js');
const CAIRN_ROOT = app.isPackaged
  ? (process.env.CAIRN_HOME ?? join(homedir(), '.cairn'))
  : resolve(__dirname, '../../../..');

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
    regex: /NotionPublisherService|worklog page (created|already exists)|publish done/i,
    step: 'publish',
  },
  { regex: /orchestrator\.run done/, step: 'done' },
];

function stripAnsi(s: string): string {
  return s.replace(ANSI_REGEX, '');
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

let running: ChildProcess | null = null;

export function isRunning(): boolean {
  return running !== null;
}

// Claude 연결 확인 — core 를 --probe-claude 로 fork, stdout 의 CLAUDE_OK 확인 (가벼운 query 1회)
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
  sender?: WebContents,
): Promise<CoreResult> {
  if (running) throw new Error('이미 다른 작업이 실행 중입니다');

  const emit = (level: 'info' | 'err' | 'meta', line: string): void => {
    sender?.send('cairn:run-line', { mode, level, line: stripAnsi(line) });
  };

  let currentStep: RunStep = 'boot';
  const emitStep = (step: RunStep): void => {
    if (stepRank(step) <= stepRank(currentStep)) return;
    currentStep = step;
    sender?.send('cairn:run-step', { mode, step });
  };
  sender?.send('cairn:run-step', { mode, step: currentStep });

  const args = [`--mode=${mode}`];
  if (options.backfillDays !== undefined) args.push(`--backfill-days=${options.backfillDays}`);
  if (options.force) args.push('--force');
  if (options.date) args.push(`--date=${options.date}`);
  args.push(`--lang=${readSettings().language}`);

  emit('meta', `[fork] ${CORE_ENTRY} ${args.join(' ')}`);
  emit('meta', `[cwd] ${CAIRN_ROOT}`);

  const child = fork(CORE_ENTRY, args, {
    cwd: CAIRN_ROOT,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, CAIRN_PACKAGED: app.isPackaged ? 'true' : 'false', ...claudeEnv() },
  });
  running = child;
  emit('meta', `[fork] pid=${child.pid ?? '?'}`);

  const stderrLines: string[] = [];
  let stdoutAll = '';
  let noActivity = false;

  child.stdout?.on('data', (buf: Buffer) => {
    const text = stripAnsi(buf.toString('utf8'));
    stdoutAll += text;
    if (NO_ACTIVITY_REGEX.test(text)) noActivity = true;
    for (const line of text.split('\n')) {
      if (line.length === 0) continue;
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
      const tail = stderrLines.slice(-STDERR_TAIL_LINES).join('\n');
      const urlMatches = stdoutAll.match(NOTION_URL_REGEX) ?? [];
      const lastUrl = urlMatches.at(-1)?.replace(/["',}\]]+$/, '') ?? null;
      const kindMatches = [...stdoutAll.matchAll(PUBLISH_KIND_REGEX)];
      const lastKind = (kindMatches.at(-1)?.[1] as PublishKind) ?? null;
      const pageIdMatches = [...stdoutAll.matchAll(PAGE_ID_REGEX)];
      const lastPageId = pageIdMatches.at(-1)?.[1] ?? null;
      const finalNoActivity = noActivity && !lastKind && !lastUrl && !lastPageId;
      emit('meta', `[exit] code=${exitCode ?? 'null'}`);
      if (exitCode === 0) emitStep('done');
      const result: CoreResult = {
        ok: exitCode === 0,
        exitCode,
        notionUrl: lastUrl,
        publishKind: lastKind,
        publishPageId: lastPageId,
        noActivity: finalNoActivity,
        stderrTail: tail,
      };
      const outcome = result.ok ? (finalNoActivity ? 'no-activity' : 'ok') : 'fail';
      trackPublish(mode, outcome);
      sendResultNotification(mode, result);
      resolvePromise(result);
    });
    child.on('error', (err) => {
      running = null;
      emit('err', `[error] ${err.message}`);
      resolvePromise({
        ok: false,
        exitCode: null,
        notionUrl: null,
        publishKind: null,
        publishPageId: null,
        noActivity: false,
        stderrTail: err.message,
      });
    });
  });
}
