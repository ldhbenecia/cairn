import { existsSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withFileLock } from './file-lock.js';

const tmp = (): string => mkdtempSync(join(tmpdir(), 'cairn-lock-'));

describe('withFileLock', () => {
  it('락이 없으면 임계구역 실행 + 후 락 파일 정리', () => {
    const dir = tmp();
    const target = join(dir, 'x.json');
    const r = withFileLock(target, () => {
      writeFileSync(target, 'in-critical');
      return 42;
    });
    expect(r).toBe(42);
    expect(existsSync(`${target}.lock`)).toBe(false);
    expect(readFileSync(target, 'utf8')).toBe('in-critical');
  });

  it('stale 락(오래된 mtime)은 회수하고 진입', () => {
    const dir = tmp();
    const target = join(dir, 'y.json');
    const lock = `${target}.lock`;
    writeFileSync(lock, '');
    // mtime 을 과거로 — STALE_MS(30s) 초과
    const old = Date.now() / 1000 - 120;
    utimesSync(lock, old, old);
    const r = withFileLock(target, () => 'reclaimed');
    expect(r).toBe('reclaimed');
    expect(existsSync(lock)).toBe(false);
  });

  it('예외를 던져도 락은 해제된다', () => {
    const dir = tmp();
    const target = join(dir, 'z.json');
    expect(() =>
      withFileLock(target, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(existsSync(`${target}.lock`)).toBe(false);
  });
});
