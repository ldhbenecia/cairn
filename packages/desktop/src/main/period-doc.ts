import { app, shell } from 'electron';
import { fork } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { claudeEnv } from './claude-path';
import { appendSideLog, CORE_ENTRY, summaryModelEnv } from './core-runner';
import { createExtractor, type FailureHint } from './core-runner-extract';
import { journalFolder } from './journal-reader';
import {
  isValidRange,
  parsePeriodDocEvent,
  PERIOD_DOC_DIR,
  periodDocFileName,
  type PeriodDocRange,
} from './period-doc-events';
import { readSettings } from './settings';
import { CAIRN_ROOT } from './setup';

export type PeriodDocResult =
  | { status: 'ok'; fileName: string; content: string }
  | { status: 'empty' }
  | { status: 'fail'; hint: FailureHint };

// 1년치 입력이면 요약 1회가 수 분 걸림
const TIMEOUT_MS = 5 * 60_000;

let inflight: Promise<PeriodDocResult> | null = null;

async function docPath(range: PeriodDocRange): Promise<string> {
  return join(await journalFolder(), PERIOD_DOC_DIR, periodDocFileName(range));
}

export async function readPeriodDoc(range: unknown): Promise<string | null> {
  if (!isValidRange(range)) return null;
  try {
    return await readFile(await docPath(range), 'utf8');
  } catch {
    return null;
  }
}

export async function revealPeriodDoc(range: unknown): Promise<void> {
  if (!isValidRange(range)) return;
  const path = await docPath(range);
  if (existsSync(path)) shell.showItemInFolder(path);
}

export function generatePeriodDoc(range: unknown): Promise<PeriodDocResult> {
  if (!isValidRange(range)) return Promise.resolve({ status: 'fail', hint: null });
  inflight ??= run(range).finally(() => {
    inflight = null;
  });
  return inflight;
}

function run(range: PeriodDocRange): Promise<PeriodDocResult> {
  const settings = readSettings();
  const args = [
    '--period-doc',
    `--since=${range.since}`,
    `--until=${range.until}`,
    `--lang=${settings.language}`,
  ];
  appendSideLog('period-doc', 'meta', `[fork] ${args.join(' ')}`);

  return new Promise((resolve) => {
    const child = fork(CORE_ENTRY, args, {
      cwd: CAIRN_ROOT,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      // 일지·통계만 읽음 — GitHub·Notion 토큰은 전달 안 함
      env: {
        ...process.env,
        NODE_ENV: app.isPackaged ? 'production' : (process.env.NODE_ENV ?? 'development'),
        CAIRN_PACKAGED: app.isPackaged ? 'true' : 'false',
        ...claudeEnv(),
        ...summaryModelEnv(settings.summaryModel),
      },
    });

    const ext = createExtractor();
    let written: string | null = null;
    let empty = false;

    const pipe = (stream: NodeJS.ReadableStream | null, level: 'info' | 'err'): void => {
      const decoder = new StringDecoder('utf8');
      let carry = '';
      stream?.on('data', (buf: Buffer) => {
        const lines = (carry + decoder.write(buf)).split('\n');
        carry = lines.pop() ?? '';
        for (const line of lines) {
          if (!line) continue;
          ext.feed(line);
          appendSideLog('period-doc', level, line);
        }
      });
    };
    pipe(child.stdout, 'info');
    pipe(child.stderr, 'err');

    child.on('message', (raw) => {
      const ev = parsePeriodDocEvent(raw);
      if (ev?.type === 'written') written = ev.fileName;
      if (ev?.type === 'empty') empty = true;
    });

    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    let settled = false;
    const finish = (r: PeriodDocResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      appendSideLog('period-doc', r.status === 'fail' ? 'err' : 'meta', `[done] ${r.status}`);
      resolve(r);
    };

    child.on('error', () => finish({ status: 'fail', hint: ext.failureHint }));
    child.on('close', () => {
      if (empty) return finish({ status: 'empty' });
      if (!written) return finish({ status: 'fail', hint: ext.failureHint });
      const fileName = written;
      void (async () => {
        const content = await readPeriodDoc(range);
        if (content === null) return finish({ status: 'fail', hint: null });
        await mirrorToExport(fileName, content);
        finish({ status: 'ok', fileName, content });
      })();
    });
  });
}

// 자동 동기화가 켜져 있으면 Obsidian 미러에도 같은 하위 폴더로 복사
async function mirrorToExport(fileName: string, content: string): Promise<void> {
  const cfg = readSettings().export;
  if (!cfg.autoSync || !cfg.folder) return;
  try {
    const dir = join(cfg.folder, PERIOD_DOC_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, fileName), content, 'utf8');
  } catch (err) {
    appendSideLog('period-doc', 'err', `[mirror] ${String(err)}`);
  }
}
