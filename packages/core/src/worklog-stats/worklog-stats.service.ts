import { Injectable } from '@nestjs/common';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type WorklogStat = { pr: number; commit: number; hours?: number[]; updatedAt?: string };
export type WorklogStatsFile = Record<string, WorklogStat>;

const STATS_DIR = join(homedir(), '.cairn');
const STATS_PATH = join(STATS_DIR, 'worklog-stats.json');

// 발행된 일지의 PR·커밋·시간대 통계를 로컬에 보관. 노션은 출력 전용이고 사용자가 속성을
// 지우거나 고칠 수 있으므로, 대시보드/롤업 통계의 진실 소스는 로컬 파일로 둔다(ADR 0027).
@Injectable()
export class WorklogStatsService {
  record(category: string, date: string, stat: WorklogStat): void {
    try {
      const all = this.readAll();
      all[`${category}:${date}`] = { ...stat, updatedAt: new Date().toISOString() };
      mkdirSync(STATS_DIR, { recursive: true });
      const tmp = `${STATS_PATH}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(all), 'utf8');
      renameSync(tmp, STATS_PATH);
    } catch {
      // 통계 기록 실패가 발행을 막지 않음(best-effort)
    }
  }

  readAll(): WorklogStatsFile {
    try {
      return JSON.parse(readFileSync(STATS_PATH, 'utf8')) as WorklogStatsFile;
    } catch {
      return {};
    }
  }
}
