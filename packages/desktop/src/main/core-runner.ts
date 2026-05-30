import type { WebContents } from 'electron';
import { fork, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendResultNotification } from './notifier';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

export type CoreMode = 'daily' | 'weekly' | 'monthly';

export type CoreRunOptions = {
  backfillDays?: number;
};

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

export type CoreResult = {
  ok: boolean;
  exitCode: number | null;
  notionUrl: string | null;
  publishKind: PublishKind;
  publishPageId: string | null;
  noActivity: boolean;
  stderrTail: string;
};

const CORE_ENTRY = resolve(__dirname, '../../../core/dist/main.js');
const CAIRN_ROOT = resolve(__dirname, '../../../..');

const STDERR_TAIL_LINES = 20;
const NOTION_URL_REGEX = /https:\/\/www\.notion\.so\/\S+/g;
const NO_ACTIVITY_REGEX = /no activity collected/i;
const PUBLISH_KIND_REGEX = /"kind"\s*:\s*"(created|recreated|skipped|no-target)"/g;
const PAGE_ID_REGEX = /"pageId"\s*:\s*"([0-9a-f-]{32,36})"/g;
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_REGEX, '');
}

let running: ChildProcess | null = null;

export function isRunning(): boolean {
  return running !== null;
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

  const args = [`--mode=${mode}`];
  if (options.backfillDays !== undefined) args.push(`--backfill-days=${options.backfillDays}`);

  emit('meta', `[fork] ${CORE_ENTRY} ${args.join(' ')}`);
  emit('meta', `[cwd] ${CAIRN_ROOT}`);

  const child = fork(CORE_ENTRY, args, {
    cwd: CAIRN_ROOT,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
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
    for (const line of text.split('\n')) if (line.length > 0) emit('info', line);
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
      emit('meta', `[exit] code=${exitCode ?? 'null'}`);
      const result: CoreResult = {
        ok: exitCode === 0,
        exitCode,
        notionUrl: lastUrl,
        publishKind: lastKind,
        publishPageId: lastPageId,
        noActivity,
        stderrTail: tail,
      };
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
