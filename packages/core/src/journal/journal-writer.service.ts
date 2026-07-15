import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { RollupPeriod } from '../contracts/rollup-activity.types.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import {
  dailyFileName,
  renderDailyJournalMarkdown,
  renderRollupJournalMarkdown,
  rollupFileName,
  type DailyJournalInput,
  type RollupJournalInput,
} from './journal-markdown.js';
import { saveSnapshotIfChanged } from './journal-snapshot.js';

export interface JournalWriteResult {
  fileName: string;
  path: string;
}

const DEFAULT_FOLDER = join('Documents', 'Cairn Journal');

@Injectable()
export class JournalWriterService {
  constructor(
    private readonly worklogConfig: WorklogConfigService,
    @InjectPinoLogger(JournalWriterService.name)
    private readonly logger: PinoLogger,
  ) {}

  writeDaily(input: DailyJournalInput): JournalWriteResult {
    return this.write(dailyFileName(input.date), renderDailyJournalMarkdown(input));
  }

  writeRollup(input: RollupJournalInput): JournalWriteResult {
    return this.write(
      rollupFileName(input.period, input.rangeStart),
      renderRollupJournalMarkdown(input),
    );
  }

  folder(): string {
    const configured = this.worklogConfig.load().journal?.folder;
    if (!configured) return join(homedir(), DEFAULT_FOLDER);
    // resolve() 는 '~' 를 확장하지 않는다 — cwd 아래 '~/...' 로 새는 것 방지
    const expanded = configured.startsWith('~/')
      ? join(homedir(), configured.slice(2))
      : configured;
    return resolve(expanded);
  }

  hasDaily(date: string): boolean {
    return existsSync(join(this.folder(), dailyFileName(date)));
  }

  hasRollup(period: RollupPeriod, rangeStart: string): boolean {
    return existsSync(join(this.folder(), rollupFileName(period, rangeStart)));
  }

  private write(fileName: string, content: string): JournalWriteResult {
    const folder = this.folder();
    mkdirSync(folder, { recursive: true });
    const path = join(folder, fileName);
    try {
      // 재발행이 이전본(사용자 편집 포함)을 지우지 않게 — 실패해도 발행은 계속
      if (saveSnapshotIfChanged(path, fileName, content)) {
        this.logger.info({ fileName }, 'journal snapshot saved');
      }
    } catch (err) {
      this.logger.warn({ fileName, err: String(err) }, 'journal snapshot failed');
    }
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, content, 'utf8');
    renameSync(tmp, path);
    this.logger.info({ fileName }, 'journal write done');
    return { fileName, path };
  }
}
