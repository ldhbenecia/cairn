import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic } from './atomic-write';

const STATE_PATH = join(homedir(), '.cairn', 'auto-publish-state.json');

export type AutoPublishState = {
  daily?: string;
  weekly?: string;
  monthly?: string;
  yearly?: string;
};

export function readAutoPublishState(): AutoPublishState {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as AutoPublishState;
  } catch {
    return {};
  }
}

export function writeAutoPublishState(state: AutoPublishState): void {
  try {
    writeFileAtomic(STATE_PATH, JSON.stringify(state));
  } catch {
    // best-effort — 상태 기록 실패가 발행을 막지 않음
  }
}
