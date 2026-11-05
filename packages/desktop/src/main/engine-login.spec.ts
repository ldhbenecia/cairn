import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cp = vi.hoisted(() => ({ execFile: vi.fn(), spawn: vi.fn() }));
vi.mock('node:child_process', () => cp);
vi.mock('./claude-path', () => ({
  claudePathReady: () => Promise.resolve(),
  resolveClaudePath: () => '/bin/claude',
  findInPath: (exe: string) => (exe === 'codex' ? '/bin/codex' : null),
  searchPathEnv: () => '/bin',
}));
const bc = vi.hoisted(() => ({ broadcast: vi.fn() }));
vi.mock('./broadcast', () => bc);
vi.mock('./secret-store', () => ({ envWithoutSecrets: () => ({ HOME: '/h' }) }));

import {
  cancelEngineLogin,
  engineLoggedIn,
  startEngineLogin,
  submitEngineLoginCode,
} from './engine-login';

type Cb = (err: Error | null, out: string) => void;

function fakeLogin() {
  const child = new EventEmitter() as EventEmitter & {
    stdin: PassThrough;
    kill: () => void;
  };
  child.stdin = new PassThrough();
  child.kill = () => child.emit('close', null);
  return child;
}

beforeEach(() => {
  cp.execFile.mockReset();
  cp.spawn.mockReset();
});

describe('engineLoggedIn', () => {
  it('reads claude auth status json', async () => {
    cp.execFile.mockImplementation((_b, _a, _o, cb: Cb) => cb(null, '{"loggedIn":true}'));
    await expect(engineLoggedIn('claude')).resolves.toBe(true);
    cp.execFile.mockImplementation((_b, _a, _o, cb: Cb) => cb(null, '{"loggedIn":false}'));
    await expect(engineLoggedIn('claude')).resolves.toBe(false);
    cp.execFile.mockImplementation((_b, _a, _o, cb: Cb) => cb(null, 'not json'));
    await expect(engineLoggedIn('claude')).resolves.toBe(false);
  });

  it('uses the codex login status exit code', async () => {
    cp.execFile.mockImplementation((_b, _a, _o, cb: Cb) => cb(null, ''));
    await expect(engineLoggedIn('codex')).resolves.toBe(true);
    cp.execFile.mockImplementation((_b, _a, _o, cb: Cb) => cb(new Error('exit 1'), ''));
    await expect(engineLoggedIn('codex')).resolves.toBe(false);
  });
});

describe('startEngineLogin', () => {
  it('runs one login at a time without publish tokens and forwards a pasted code', async () => {
    const child = fakeLogin();
    cp.spawn.mockReturnValue(child);
    const first = startEngineLogin('claude');
    await Promise.resolve();
    await expect(startEngineLogin('codex')).resolves.toEqual({ ok: false, error: 'busy' });

    const [bin, args, opts] = cp.spawn.mock.calls[0]! as [string, string[], { env: object }];
    expect(bin).toBe('/bin/claude');
    expect(args).toEqual(['auth', 'login', '--claudeai']);
    expect(opts.env).toEqual({ HOME: '/h', PATH: '/bin' });

    let written = '';
    child.stdin.on('data', (b: Buffer) => (written += b.toString()));
    expect(submitEngineLoginCode('abc\ndef')).toBe(false);
    expect(submitEngineLoginCode('x'.repeat(513))).toBe(false);
    expect(submitEngineLoginCode('  code-123 ')).toBe(true);
    await new Promise((r) => setImmediate(r));
    expect(written).toBe('code-123\n');

    child.emit('close', 0);
    await expect(first).resolves.toEqual({ ok: true });
    expect(bc.broadcast).toHaveBeenCalledWith('cairn:engine:login-done', 'claude');
    expect(submitEngineLoginCode('late')).toBe(false);
  });

  it('reports a cancelled or failed login', async () => {
    const child = fakeLogin();
    cp.spawn.mockReturnValue(child);
    const run = startEngineLogin('codex');
    await Promise.resolve();
    cancelEngineLogin();
    await expect(run).resolves.toEqual({ ok: false, error: 'failed' });
    expect(bc.broadcast).not.toHaveBeenCalledWith('cairn:engine:login-done', 'codex');
  });
});
