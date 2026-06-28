import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const STATE_PATH = join(homedir(), '.cairn', 'auto-publish-state.json');

export type AutoPublishState = { daily?: string; weekly?: string; monthly?: string };

export function readAutoPublishState(): AutoPublishState {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as AutoPublishState;
  } catch {
    return {};
  }
}

export function writeAutoPublishState(state: AutoPublishState): void {
  try {
    mkdirSync(dirname(STATE_PATH), { recursive: true });
    const tmp = `${STATE_PATH}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(state), 'utf8');
    renameSync(tmp, STATE_PATH);
  } catch {
    // best-effort — 상태 기록 실패가 발행을 막지 않음
  }
}
