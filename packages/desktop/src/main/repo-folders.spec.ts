import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { expandRepoFolders } from './repo-folders';

let root: string;
const dir = (...p: string[]): string => {
  const d = join(root, ...p);
  mkdirSync(d, { recursive: true });
  return d;
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cairn-repos-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('expandRepoFolders', () => {
  it('git 저장소를 고르면 그대로', () => {
    const repo = dir('cairn');
    dir('cairn', '.git');
    expect(expandRepoFolders([repo])).toEqual([repo]);
  });

  it('상위 폴더를 고르면 바로 아래 저장소들로 펼침 (정렬, 숨김·일반 폴더 제외)', () => {
    const parent = dir('work');
    dir('work', 'b-repo', '.git');
    dir('work', 'a-repo', '.git');
    dir('work', 'notes');
    dir('work', '.cache', '.git');
    expect(expandRepoFolders([parent])).toEqual([join(parent, 'a-repo'), join(parent, 'b-repo')]);
  });

  it('worktree 처럼 .git 이 파일이어도 저장소로 봄', () => {
    const parent = dir('work');
    dir('work', 'wt');
    writeFileSync(join(parent, 'wt', '.git'), 'gitdir: elsewhere');
    expect(expandRepoFolders([parent])).toEqual([join(parent, 'wt')]);
  });

  it('아래에 저장소가 없으면 고른 폴더 그대로 (not-git 경고용)', () => {
    const plain = dir('plain');
    dir('plain', 'docs');
    expect(expandRepoFolders([plain])).toEqual([plain]);
  });

  it('여러 개를 고르면 합치고 중복 제거', () => {
    const parent = dir('work');
    const repo = dir('work', 'a-repo');
    dir('work', 'a-repo', '.git');
    expect(expandRepoFolders([parent, repo])).toEqual([repo]);
  });
});
