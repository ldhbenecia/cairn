import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtractedBlock } from '../notion/notion-api.types.js';
import { dailyFileName } from './journal-markdown.js';
import { parseJournalFile } from './journal-parse.js';
import { JournalWriterService } from './journal-writer.service.js';

export interface JournalDailyEntry {
  date: string;
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
