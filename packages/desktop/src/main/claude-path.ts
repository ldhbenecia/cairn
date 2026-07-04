import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

let cachedDirs: string[] | undefined;
let cachedClaude: string | null | undefined;

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

const LOGIN_SHELL_ARGS = ['-ilc', 'echo __CAIRN_PATH__"$PATH"'] as const;
const LOGIN_SHELL_TIMEOUT_MS = 5000;

function parseLoginShellPath(out: string): string[] {
  const captured = out.match(/__CAIRN_PATH__(.*)/)?.[1];
  return captured ? captured.trim().split(delimiter).filter(Boolean) : [];
}

function loginShellDirs(): string[] {
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const out = execFileSync(shell, [...LOGIN_SHELL_ARGS], {
      encoding: 'utf8',
      timeout: LOGIN_SHELL_TIMEOUT_MS,
    });
    return parseLoginShellPath(out);
  } catch {
    return [];
  }
}

function buildDirs(loginDirs: string[]): string[] {
  return dedupe([
    ...loginDirs,
    ...(process.env.PATH?.split(delimiter).filter(Boolean) ?? []),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    join(homedir(), '.claude', 'local'),
    join(homedir(), '.local', 'bin'),
    join(homedir(), '.npm-global', 'bin'),
  ]);
}

function searchDirs(): string[] {
  if (cachedDirs) return cachedDirs;
  cachedDirs = buildDirs(loginShellDirs());
  return cachedDirs;
}

// 로그인 셸 PATH 캡처(최대 5초, .zshrc 느리면 그만큼)를 앱 시작 시 비동기로 예열 —
// 첫 발행/probe 의 동기 경로가 메인 프로세스(UI)를 블록하지 않게
export async function warmClaudePath(): Promise<void> {
  if (cachedDirs) return;
  const shell = process.env.SHELL || '/bin/zsh';
  const loginDirs = await new Promise<string[]>((resolve) => {
    execFile(
      shell,
      [...LOGIN_SHELL_ARGS],
      { encoding: 'utf8', timeout: LOGIN_SHELL_TIMEOUT_MS },
      (err, out) => resolve(err ? [] : parseLoginShellPath(out)),
    );
  });
  if (!cachedDirs) cachedDirs = buildDirs(loginDirs);
  resolveClaudePath();
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
