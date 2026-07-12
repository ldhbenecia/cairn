import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dropForbiddenMemos, memoTextsForDate, parseMemosFile } from './memo-file.js';

const MEMOS_PATH = join(homedir(), '.cairn', 'memos.json');

// journal 직접 append 금지 — journal 존재 = '발행됨' 스킵 가드 (ADR 0032)
@Injectable()
export class MemoSourceService {
  constructor(
    @InjectPinoLogger(MemoSourceService.name)
    private readonly logger: PinoLogger,
  ) {}

  forDate(date: string): string[] {
    let raw: string;
    try {
      raw = readFileSync(MEMOS_PATH, 'utf8');
    } catch {
      return [];
    }
    const { kept, dropped } = dropForbiddenMemos(memoTextsForDate(parseMemosFile(raw), date));
    if (dropped > 0) {
      this.logger.warn({ date, dropped }, 'memos: forbidden pattern — dropped');
    }
    if (kept.length > 0) {
      this.logger.info({ date, count: kept.length }, 'memos: loaded for summarizer');
    }
    return kept;
  }
}
