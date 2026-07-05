import { app } from 'electron';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

export const CAIRN_ROOT = app.isPackaged
  ? (process.env.CAIRN_HOME ?? join(homedir(), '.cairn'))
  : resolve(__dirname, '../../../..');

export const CONFIG_PATH = join(CAIRN_ROOT, 'worklog.config.json');
export const ENV_PATH = join(CAIRN_ROOT, '.env');

export function readEnvFile(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  } catch {
    // .env 없음
  }
  return out;
}

type ConfigShape = {
  notionWorkspaces?: { tokenEnv?: string; worklog?: { pageId?: string } }[];
  githubAccounts?: { tokenEnv?: string }[];
  localGitRepos?: string[];
};

// 로컬 우선(ADR 0031): 노션 없이도 활동 소스(로컬 Git 또는 GitHub) 하나면 셋업 완료
export function isSetupComplete(): boolean {
  let config: ConfigShape;
  try {
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as ConfigShape;
  } catch {
    return false;
  }
  if (!config || typeof config !== 'object') return false;
  const env = readEnvFile();
  const reposOk = (config.localGitRepos ?? []).length > 0;
  const githubOk = (config.githubAccounts ?? []).some((g) => !!g.tokenEnv && !!env[g.tokenEnv]);
  const notionOk = (config.notionWorkspaces ?? []).some(
    (ws) => !!ws.worklog?.pageId && !!ws.tokenEnv && !!env[ws.tokenEnv],
  );
  return reposOk || githubOk || notionOk;
}
