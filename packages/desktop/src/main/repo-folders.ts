import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// .git 은 dir·file(worktree) 둘 다 가능 — existsSync 로 커버
export const isRepo = (dir: string): boolean => existsSync(join(dir, '.git'));

// 레포를 모아 둔 상위 폴더를 고르면 바로 아래 git 저장소들로 펼침 — 하나도 없으면 그대로 둬 not-git 경고가 뜨게 함
export function expandRepoFolders(picked: readonly string[]): string[] {
  const out: string[] = [];
  for (const dir of picked) {
    if (isRepo(dir)) {
      out.push(dir);
      continue;
    }
    let children: string[] = [];
    try {
      children = readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => join(dir, e.name))
        .filter(isRepo)
        .sort();
    } catch {
      // 읽기 권한 없음 등은 고른 폴더 그대로 — probe 가 경고로 알려 줌
    }
    out.push(...(children.length > 0 ? children : [dir]));
  }
  return [...new Set(out)];
}
