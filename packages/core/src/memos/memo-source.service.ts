import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dropForbiddenMemos, memoTextsForDate, parseMemosFile } from './memo-file.js';

const MEMOS_PATH = join(homedir(), '.cairn', 'memos.json');

// 데스크톱 quick capture 가 쌓은 수동 메모(~/.cairn/memos.json)를 발행 시점에 읽어
// summarizer 입력에 병합한다. journal 파일에 직접 append 하지 않는 이유는 ADR 0032 —
// journal 존재는 '이미 발행됨' 스킵 가드라서, 미발행 날짜에 파일이 생기면 자동 발행이 스킵된다.
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
