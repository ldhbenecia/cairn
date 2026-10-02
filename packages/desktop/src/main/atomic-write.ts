import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

let seq = 0;

// temp 에 쓰고 rename — 중간 크래시·동시 write 로 인한 손상 방지, tmp 이름의 pid+seq 로 서로의 tmp 를 안 덮음
// mode 를 주면 tmp 를 그 권한으로 생성해 rename 후 노출 창 없이 보호 권한 보장
export function writeFileAtomic(path: string, data: string, mode?: number): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${seq++}.tmp`;
  writeFileSync(tmp, data, { encoding: 'utf8', mode });
  renameSync(tmp, path);
}
