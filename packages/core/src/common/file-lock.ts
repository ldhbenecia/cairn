import { closeSync, openSync, rmSync, statSync } from 'node:fs';

const STALE_MS = 30_000;
const MAX_WAIT_MS = 3_000;
const RETRY_MS = 25;

// CPU 점유 없는 동기 대기 (Node main thread 에서 Atomics.wait 허용)
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
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
          rmSync(lockPath, { force: true });
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
