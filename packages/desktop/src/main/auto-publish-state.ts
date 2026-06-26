import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const STATE_PATH = join(homedir(), '.cairn', 'auto-publish-state.json');

// 마지막으로 성공 발행한 weekly/monthly 기간의 anchor 날짜(YYYY-MM-DD).
// 발화 시점에 앱이 꺼져 있어도 다음 실행에서 미발행 기간을 catch-up 하기 위함.
export type AutoPublishState = { weekly?: string; monthly?: string };

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
