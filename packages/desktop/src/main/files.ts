import { readFile, stat } from 'node:fs/promises';
import { CONFIG_PATH } from './setup';

export type ConfigResult = {
  raw: string | null;
  parsed: unknown;
  path: string;
};

// mtime 기반 캐시 — journalFolder()·notion fetch 등이 스캔·백필 중 config 를 페이지당 수십·수백 번
// 다시 읽고 JSON.parse 하던 것을 제거. 파일이 바뀌면(mtime 변경) 다음 호출에서 재파싱하므로
// 발행/설정 변경은 그대로 반영된다
let cache: { mtimeMs: number; result: ConfigResult } | null = null;

export async function readConfig(): Promise<ConfigResult> {
  try {
    const { mtimeMs } = await stat(CONFIG_PATH);
    if (cache && cache.mtimeMs === mtimeMs) return cache.result;
    const raw = await readFile(CONFIG_PATH, 'utf8');
    const result: ConfigResult = { raw, parsed: JSON.parse(raw), path: CONFIG_PATH };
    cache = { mtimeMs, result };
    return result;
  } catch {
    cache = null;
    return { raw: null, parsed: null, path: CONFIG_PATH };
  }
}
