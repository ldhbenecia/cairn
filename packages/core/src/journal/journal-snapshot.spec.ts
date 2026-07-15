import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  KEEP_PER_FILE,
  pruneSnapshots,
  saveSnapshotIfChanged,
  snapshotDirFor,
  snapshotStamp,
} from './journal-snapshot.js';

const tmp = mkdtempSync(join(tmpdir(), 'cairn-snap-'));
const root = join(tmp, 'snapshots');

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('saveSnapshotIfChanged', () => {
  it('내용이 바뀌면 이전본을 스냅샷으로 저장한다', () => {
    const cur = join(tmp, '2026-07-15.md');
    writeFileSync(cur, 'v1', 'utf8');
    const saved = saveSnapshotIfChanged(cur, '2026-07-15.md', 'v2', new Date(), root);
    expect(saved).toBe(true);
    const dir = snapshotDirFor('2026-07-15.md', root);
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(readFileSync(join(dir, files[0]!), 'utf8')).toBe('v1');
  });

  it('내용이 같거나 파일이 없으면 저장하지 않는다', () => {
    const cur = join(tmp, 'same.md');
    writeFileSync(cur, 'v1', 'utf8');
    expect(saveSnapshotIfChanged(cur, 'same.md', 'v1', new Date(), root)).toBe(false);
    expect(saveSnapshotIfChanged(join(tmp, 'nope.md'), 'nope.md', 'v1', new Date(), root)).toBe(
      false,
    );
  });
});

describe('pruneSnapshots', () => {
  it(`파일당 최근 ${KEEP_PER_FILE}개만 보존한다`, () => {
    const dir = snapshotDirFor('2026-07-15.md', root);
    const cur = join(tmp, 'prune.md');
    for (let i = 0; i < KEEP_PER_FILE + 3; i++) {
      writeFileSync(cur, `v${i}`, 'utf8');
      saveSnapshotIfChanged(
        cur,
        '2026-07-15.md',
        `v${i + 1}`,
        new Date(2026, 6, 15, 10, 0, i),
        root,
      );
    }
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(KEEP_PER_FILE);
    // 가장 오래된 v0~v2 가 정리되고 최신이 남는다
    expect(readFileSync(join(dir, files[files.length - 1]!), 'utf8')).toBe(`v${KEEP_PER_FILE + 2}`);
    pruneSnapshots(dir);
    expect(readdirSync(dir)).toHaveLength(KEEP_PER_FILE);
  });
});

describe('snapshotStamp', () => {
  it('사전순 = 시간순이 되는 파일시스템 안전 포맷', () => {
    const a = snapshotStamp(new Date(Date.UTC(2026, 6, 15, 1, 2, 3, 4)));
    const b = snapshotStamp(new Date(Date.UTC(2026, 6, 15, 1, 2, 3, 900)));
    expect(a).toBe('2026-07-15T01-02-03-004Z');
    expect(a < b).toBe(true);
  });
});
