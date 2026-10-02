import { readFile, stat } from 'node:fs/promises';
import { CONFIG_PATH } from './setup';
import type { ConfigResult } from '../shared/ipc-types';
export type { ConfigResult } from '../shared/ipc-types';

// mtime 기반 캐시 — 스캔·백필 중 config 를 페이지당 수백 번 다시 읽고 파싱하지 않게
// mtime 이 바뀌면 다음 호출에서 재파싱해 설정 변경은 그대로 반영
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
