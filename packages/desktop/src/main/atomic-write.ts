import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

let seq = 0;

// temp 에 쓰고 rename — 부분 write(중간 크래시)나 동시 write 로 인한 파일 손상을 막는다.
// rename 은 동일 FS 에서 원자적이고, tmp 이름에 pid+seq 를 넣어 프로세스 간/내 동시 write 가
// 서로의 tmp 를 덮어쓰지 않게 한다.
export function writeFileAtomic(path: string, data: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${seq++}.tmp`;
  writeFileSync(tmp, data, 'utf8');
  renameSync(tmp, path);
}
