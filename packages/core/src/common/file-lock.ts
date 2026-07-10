import { closeSync, linkSync, openSync, renameSync, rmSync, statSync } from 'node:fs';

const STALE_MS = 30_000;
const MAX_WAIT_MS = 3_000;
const RETRY_MS = 25;

// CPU 점유 없는 동기 대기 (Node main thread 에서 Atomics.wait 허용)
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// stale 락 회수를 원자화 — 두 대기자가 동시에 stale 판정 후 각자 rmSync 하면 한쪽이 상대의
// '새로 획득한 유효 락'을 지워 임계구역이 겹친다. rename 은 한쪽만 성공하고, 훔친 파일이
// 사실 갓 만든 유효 락이면(회수와 재획득이 교차한 경합) mtime 을 재검해 되돌린다.
function reclaimStale(lockPath: string): void {
  const stealPath = `${lockPath}.${process.pid}.steal`;
  try {
    renameSync(lockPath, stealPath);
  } catch {
    return; // 다른 대기자가 먼저 회수/획득 — 재시도
  }
  try {
    if (Date.now() - statSync(stealPath).mtimeMs <= STALE_MS) {
      // 훔친 게 사실 유효한 락(회수와 재획득이 교차) — 원위치 복원.
      // rename 은 대상이 있으면 말없이 덮어써 그새 획득된 남의 락을 지운다.
      // linkSync 는 대상이 있으면 EEXIST 로 실패 → 덮어쓰기 없음
      linkSync(stealPath, lockPath);
    }
  } catch {
    // stale 이었거나(위 분기 통과) 복원 불가(그새 다른 프로세스가 획득) — stealPath 만 정리
  } finally {
    rmSync(stealPath, { force: true });
  }
}

// 같은 파일을 여러 프로세스(desktop main + forked core)가 read-modify-write 할 때 직렬화한다.
// `${target}.lock` 을 O_EXCL 로 잡아 임계구역을 보호. 보유 프로세스가 크래시하면 stale(mtime)
// 로 회수. 경합이 지속돼 MAX_WAIT 안에 못 잡으면 throw — 호출자가 실패를 처리해야 한다.
export function withFileLock<T>(targetPath: string, fn: () => T): T {
  const lockPath = `${targetPath}.lock`;
  const deadline = Date.now() + MAX_WAIT_MS;
  let fd: number | null = null;
  while (Date.now() < deadline) {
    try {
      fd = openSync(lockPath, 'wx');
      break;
    } catch {
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > STALE_MS) {
          reclaimStale(lockPath);
          continue;
        }
      } catch {
        continue; // 락이 그새 풀림 — 즉시 재시도
      }
      sleepSync(RETRY_MS);
    }
  }
  if (fd === null) {
    throw new Error(`withFileLock: lock not acquired for ${targetPath} within ${MAX_WAIT_MS}ms`);
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    rmSync(lockPath, { force: true });
  }
}
