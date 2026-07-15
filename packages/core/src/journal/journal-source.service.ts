import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtractedBlock } from '../notion/notion-api.types.js';
import type { RollupPeriod } from '../contracts/rollup-activity.types.js';
import type { WorklogSummary } from '../contracts/worklog-summary.types.js';
import { dailyFileName, rollupFileName } from './journal-markdown.js';
import { blocksToWorklogSummary, parseJournalFile } from './journal-parse.js';
import { JournalWriterService } from './journal-writer.service.js';

export interface JournalDailyEntry {
  date: string;
  fileName: string;
  blocks: ExtractedBlock[];
}

export interface JournalMonthlyEntry {
  // 해당 월의 rangeStart (YYYY-MM-01)
  rangeStart: string;
  fileName: string;
  blocks: ExtractedBlock[];
}

@Injectable()
export class JournalSourceService {
  constructor(
    private readonly writer: JournalWriterService,
    @InjectPinoLogger(JournalSourceService.name)
    private readonly logger: PinoLogger,
  ) {}

  // 재발행 경로용 — journal daily md 를 WorklogSummary 로 복원 (파일 없음/파싱 실패/빈 내용이면 null)
  readDailySummary(date: string): WorklogSummary | null {
    const path = join(this.writer.folder(), dailyFileName(date));
    if (!existsSync(path)) return null;
    try {
      const { blocks } = parseJournalFile(readFileSync(path, 'utf8'));
      return blocksToWorklogSummary(blocks);
    } catch (err) {
      this.logger.warn({ date, err: String(err) }, 'journal daily read failed — republish skipped');
      return null;
    }
  }

  listDailyEntries(rangeStart: string, rangeEnd: string): JournalDailyEntry[] {
    const folder = this.writer.folder();
    const entries: JournalDailyEntry[] = [];
    for (const date of datesInRange(rangeStart, rangeEnd)) {
      const fileName = dailyFileName(date);
      const path = join(folder, fileName);
      if (!existsSync(path)) continue;
      try {
        const { blocks } = parseJournalFile(readFileSync(path, 'utf8'));
        entries.push({ date, fileName, blocks });
      } catch (err) {
        this.logger.warn({ date, err: String(err) }, 'journal daily read failed — skipping');
      }
    }
    return entries;
  }

  // AI 해설의 직전 기간 컨텍스트용 — 롤업 journal 하나의 블록 (없으면 null)
  readRollupBlocks(period: RollupPeriod, rangeStart: string): ExtractedBlock[] | null {
    const path = join(this.writer.folder(), rollupFileName(period, rangeStart));
    if (!existsSync(path)) return null;
    try {
      return parseJournalFile(readFileSync(path, 'utf8')).blocks;
    } catch {
      return null;
    }
  }

  // 연간 롤업 수집용 — 해당 연도의 월간 정리(YYYY-MM.md) 파일들
  listMonthlyRollupEntries(year: string): JournalMonthlyEntry[] {
    const folder = this.writer.folder();
    const entries: JournalMonthlyEntry[] = [];
    for (let m = 1; m <= 12; m++) {
      const month = `${year}-${String(m).padStart(2, '0')}`;
      const fileName = `${month}.md`;
      const path = join(folder, fileName);
      if (!existsSync(path)) continue;
      try {
        const { blocks } = parseJournalFile(readFileSync(path, 'utf8'));
        entries.push({ rangeStart: `${month}-01`, fileName, blocks });
      } catch (err) {
        this.logger.warn({ month, err: String(err) }, 'journal monthly read failed — skipping');
      }
    }
    return entries;
  }
}

// 문자열 달력 산술 — period-range 와 동일하게 파싱값을 UTC 로만 계산 (로컬 TZ 무관)
function datesInRange(start: string, end: string): string[] {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  if (!sy || !sm || sd === undefined || !ey || !em || ed === undefined) return [];
  const out: string[] = [];
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const last = Date.UTC(ey, em - 1, ed);
  while (cur.getTime() <= last && out.length <= 366) {
    out.push(
      `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}-${String(cur.getUTCDate()).padStart(2, '0')}`,
    );
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
