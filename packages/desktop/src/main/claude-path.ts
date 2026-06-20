import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

let cachedDirs: string[] | undefined;
let cachedClaude: string | null | undefined;

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

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
  cachedDirs = dedupe([
    ...loginShellDirs(),
    ...(process.env.PATH?.split(delimiter).filter(Boolean) ?? []),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    join(homedir(), '.claude', 'local'),
    join(homedir(), '.local', 'bin'),
    join(homedir(), '.npm-global', 'bin'),
  ]);
  return cachedDirs;
}

// 확장만 쓰는 사용자는 PATH 에 claude 가 없으므로 IDE 확장 디렉토리를 직접 뒤진다
function ideExtensionClaude(): string | null {
  const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';
  const roots = ['.vscode/extensions', '.vscode-insiders/extensions', '.cursor/extensions'].map(
    (r) => join(homedir(), r),
  );
  const found: string[] = [];
  for (const root of roots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.startsWith('anthropic.claude-code-')) continue;
      const p = join(root, name, 'resources', 'native-binary', exe);
      if (existsSync(p)) found.push(p);
    }
  }
  return found.sort().at(-1) ?? null;
}

export function resolveClaudePath(): string | null {
  if (cachedClaude !== undefined) return cachedClaude;
  const configured = process.env.CAIRN_CLAUDE_PATH;
  if (configured && existsSync(configured)) {
    cachedClaude = configured;
    return cachedClaude;
  }
  const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';
  for (const d of searchDirs()) {
    const p = join(d, exe);
    if (existsSync(p)) {
      cachedClaude = p;
      return p;
    }
  }
  cachedClaude = ideExtensionClaude();
  return cachedClaude;
}

export function claudeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { PATH: searchDirs().join(delimiter) };
  const claude = resolveClaudePath();
  if (claude) env.CAIRN_CLAUDE_PATH = claude;
  return env;
}

// GUI 앱은 PATH 가 제한적이라 로그인 셸 PATH + 공통 경로에서 바이너리를 찾는다(gh 등 재사용용)
export function findInPath(exe: string): string | null {
  for (const d of searchDirs()) {
    const p = join(d, exe);
    if (existsSync(p)) return p;
  }
  return null;
}

// gh 등 실행 시 GUI 의 빈약한 PATH 대신 확장된 PATH 를 쓰도록
export function searchPathEnv(): string {
  return searchDirs().join(delimiter);
}
