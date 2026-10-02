import { renameSync, writeFileSync } from 'node:fs';

// tmp 에 쓰고 rename — 중간 크래시·동시 write 로 인한 파일 손상 방지 (rename 은 같은 FS 에서 원자적)
export function writeFileAtomic(path: string, data: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, data, 'utf8');
  renameSync(tmp, path);
}
