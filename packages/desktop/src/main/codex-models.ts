import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CodexModel } from '../shared/ipc-types';

// argv 로 넘어가는 값 — 모델 id 형식만 허용
export function isCodexModelSlug(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z0-9][a-z0-9.-]{0,63}$/.test(v);
}

// codex CLI 에 모델 목록 명령이 없어 CLI 가 받아 둔 캐시를 읽음 — 없거나 형식이 바뀌면 빈 목록(기본 모델만)
export function codexModels(): CodexModel[] {
  try {
    const home = process.env.CODEX_HOME || join(homedir(), '.codex');
    const raw = JSON.parse(readFileSync(join(home, 'models_cache.json'), 'utf8')) as {
      models?: unknown;
    };
    if (!Array.isArray(raw.models)) return [];
    return raw.models.flatMap((m: unknown) => {
      const { slug, display_name, visibility } = (m ?? {}) as Record<string, unknown>;
      if (visibility !== 'list' || !isCodexModelSlug(slug)) return [];
      return [{ slug, name: typeof display_name === 'string' ? display_name : slug }];
    });
  } catch {
    return [];
  }
}
