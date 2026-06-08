import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

// packaged GUI 앱의 process.env.PATH 는 launchd 최소 PATH(/usr/bin:/bin...)라
// 사용자가 설치한 claude(/opt/homebrew/bin 등)를 못 찾는다. 로그인 셸 PATH 를 한 번 읽어 보강.
let cachedDirs: string[] | undefined;
let cachedClaude: string | null | undefined;

function loginShellDirs(): string[] {
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const out = execFileSync(shell, ['-ilc', 'echo __CAIRN_PATH__"$PATH"'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    const captured = out.match(/__CAIRN_PATH__(.*)/)?.[1];
    return captured ? captured.trim().split(delimiter).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function searchDirs(): string[] {
  if (cachedDirs) return cachedDirs;
  cachedDirs = [
    ...loginShellDirs(),
    ...(process.env.PATH?.split(delimiter).filter(Boolean) ?? []),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    join(homedir(), '.claude', 'local'),
    join(homedir(), '.local', 'bin'),
    join(homedir(), '.npm-global', 'bin'),
  ];
  return cachedDirs;
}

// 시스템에 설치된 claude 실행파일 경로. 못 찾으면 null.
export function resolveClaudePath(): string | null {
  if (cachedClaude !== undefined) return cachedClaude;
  for (const d of searchDirs()) {
    const p = join(d, 'claude');
    if (existsSync(p)) {
      cachedClaude = p;
      return p;
    }
  }
  cachedClaude = null;
  return null;
}

// core fork 에 넘길 env — 보강된 PATH + 해석된 claude 경로(CAIRN_CLAUDE_PATH).
export function claudeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: searchDirs().join(delimiter),
  };
  const claude = resolveClaudePath();
  if (claude) env.CAIRN_CLAUDE_PATH = claude;
  return env;
}
