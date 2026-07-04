import { readFile } from 'node:fs/promises';
import { CONFIG_PATH } from './setup';

export type ConfigResult = {
  raw: string | null;
  parsed: unknown;
  path: string;
};

export async function readConfig(): Promise<ConfigResult> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    return { raw, parsed: JSON.parse(raw), path: CONFIG_PATH };
  } catch {
    return { raw: null, parsed: null, path: CONFIG_PATH };
  }
}
