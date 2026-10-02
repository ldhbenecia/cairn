import { Injectable } from '@nestjs/common';
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { withFileLock } from '../common/file-lock.js';
import { writeFileAtomic } from '../common/atomic-write.js';

export type WorklogStat = { pr: number; commit: number; hours?: number[]; updatedAt?: string };
export type WorklogStatsFile = Record<string, WorklogStat>;

const STATS_DIR = join(homedir(), '.cairn');
const STATS_PATH = join(STATS_DIR, 'worklog-stats.json');

// 노션은 출력 전용이고 사용자가 속성을 지우거나 고칠 수 있어 대시보드·롤업 통계의 진실 소스는 로컬 파일
@Injectable()
export class WorklogStatsService {
  record(category: string, date: string, stat: WorklogStat): void {
    try {
      mkdirSync(STATS_DIR, { recursive: true });
      // 락 안에서 read-modify-write — desktop cloud-sync(별도 프로세스)와의 lost-update 방지
      withFileLock(STATS_PATH, () => {
        const all = this.readAll();
        all[`${category}:${date}`] = { ...stat, updatedAt: new Date().toISOString() };
        writeFileAtomic(STATS_PATH, JSON.stringify(all));
      });
    } catch {
      // 통계 기록 실패가 발행을 막지 않음
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
