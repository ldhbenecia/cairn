import { app } from 'electron';
import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

const CAIRN_ROOT = app.isPackaged
  ? (process.env.CAIRN_HOME ?? join(homedir(), '.cairn'))
  : resolve(__dirname, '../../../..');
const CONFIG_PATH = join(CAIRN_ROOT, 'worklog.config.json');
const LOGS_DIR = join(homedir(), '.cairn', 'logs');

const LOG_TAIL_LINES = 200;
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

export type ConfigResult = {
  raw: string | null;
  parsed: unknown;
  path: string;
};
export type LogTailResult = { lines: string[]; path: string | null };

export async function readConfig(): Promise<ConfigResult> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    return { raw, parsed: JSON.parse(raw), path: CONFIG_PATH };
  } catch {
    return { raw: null, parsed: null, path: CONFIG_PATH };
  }
}

export async function tailLatestLog(): Promise<LogTailResult> {
  try {
    const files = await readdir(LOGS_DIR);
    const logs = files.filter((f) => f.endsWith('.log'));
    if (logs.length === 0) return { lines: [], path: null };

    const stats = await Promise.all(
      logs.map(async (f) => ({ name: f, mtime: (await stat(join(LOGS_DIR, f))).mtimeMs })),
    );
    stats.sort((a, b) => b.mtime - a.mtime);
    const latest = stats[0]!.name;
    const path = join(LOGS_DIR, latest);

    const raw = await readFile(path, 'utf8');
    const lines = raw
      .replace(ANSI_REGEX, '')
      .split('\n')
      .filter((l) => l.length > 0);
    return { lines: lines.slice(-LOG_TAIL_LINES), path };
  } catch {
    return { lines: [], path: null };
  }
}
