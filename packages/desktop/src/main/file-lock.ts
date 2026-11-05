import { closeSync, linkSync, openSync, renameSync, rmSync, statSync } from 'node:fs';

const STALE_MS = 30_000;
const MAX_WAIT_MS = 3_000;
const RETRY_MS = 25;

// CPU 점유 없는 동기 대기 (Electron main 은 Node 컨텍스트라 Atomics.wait 허용)
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// stale 락 회수를 원자화 — 두 대기자가 각자 rmSync 하면 한쪽이 상대의 새 유효 락을 지움
// rename 은 한쪽만 성공하고, 훔친 파일이 갓 만든 유효 락이면 mtime 재검 후 되돌림
function reclaimStale(lockPath: string): void {
  const stealPath = `${lockPath}.${process.pid}.steal`;
  try {
    renameSync(lockPath, stealPath);
  } catch {
    return; // 다른 대기자가 먼저 회수/획득 — 재시도
  }
  try {
    if (Date.now() - statSync(stealPath).mtimeMs <= STALE_MS) {
      // 훔친 게 유효한 락이면 원위치 복원 — rename 은 대상을 말없이 덮어써 그새 획득된 남의 락을
      // 지우므로 대상이 있으면 EEXIST 로 실패하는 linkSync 사용
      linkSync(stealPath, lockPath);
    }
  } catch {
    // stale 이었거나 복원 불가(그새 다른 프로세스가 획득) — stealPath 만 정리
  } finally {
    rmSync(stealPath, { force: true });
  }
}

// 락 획득 한 번 시도 — fd, 즉시 재시도('retry'), 대기 후 재시도(null)
function tryAcquire(lockPath: string): number | 'retry' | null {
  try {
    return openSync(lockPath, 'wx');
  } catch {
    try {
      if (Date.now() - statSync(lockPath).mtimeMs > STALE_MS) {
        reclaimStale(lockPath);
        return 'retry';
      }
    } catch {
      return 'retry'; // 락이 그새 풀림
    }
    return null;
  }
}

function runLocked<T>(targetPath: string, lockPath: string, fd: number | null, fn: () => T): T {
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

// 여러 프로세스(desktop main + forked core)의 같은 파일 read-modify-write 직렬화
// `${target}.lock` 을 O_EXCL 로 잡고 크래시한 보유자는 stale(mtime)로 회수, MAX_WAIT 초과 시 throw
export function withFileLock<T>(targetPath: string, fn: () => T): T {
  const lockPath = `${targetPath}.lock`;
  const deadline = Date.now() + MAX_WAIT_MS;
  let fd: number | null = null;
  while (Date.now() < deadline) {
    const r = tryAcquire(lockPath);
    if (typeof r === 'number') {
      fd = r;
      break;
    }
    if (r === null) sleepSync(RETRY_MS);
  }
  return runLocked(targetPath, lockPath, fd, fn);
}

// 대기를 이벤트 루프에 양보하는 버전 — 동기 버전은 core 가 락을 잡고 있으면 main(UI)을 최대 MAX_WAIT 멈춤
export async function withFileLockAsync<T>(targetPath: string, fn: () => T): Promise<T> {
  const lockPath = `${targetPath}.lock`;
  const deadline = Date.now() + MAX_WAIT_MS;
  let fd: number | null = null;
  while (Date.now() < deadline) {
    const r = tryAcquire(lockPath);
    if (typeof r === 'number') {
      fd = r;
      break;
    }
    if (r === null) await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }
  return runLocked(targetPath, lockPath, fd, fn);
}
