import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { RollupPeriod } from '../contracts/rollup-activity.types.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import {
  dailyFileName,
  renderDailyVaultMarkdown,
  renderRollupVaultMarkdown,
  rollupFileName,
  type DailyVaultInput,
  type RollupVaultInput,
} from './vault-markdown.js';

export interface VaultWriteResult {
  fileName: string;
  path: string;
}

const DEFAULT_FOLDER = join('Documents', 'cairn');

@Injectable()
export class VaultWriterService {
  constructor(
    private readonly worklogConfig: WorklogConfigService,
    @InjectPinoLogger(VaultWriterService.name)
    private readonly logger: PinoLogger,
  ) {}

  writeDaily(input: DailyVaultInput): VaultWriteResult {
    return this.write(dailyFileName(input.date), renderDailyVaultMarkdown(input));
  }

  writeRollup(input: RollupVaultInput): VaultWriteResult {
    return this.write(
      rollupFileName(input.period, input.rangeStart),
      renderRollupVaultMarkdown(input),
    );
  }

  folder(): string {
    const configured = this.worklogConfig.load().vault?.folder;
    return configured ? resolve(configured) : join(homedir(), DEFAULT_FOLDER);
  }

  hasDaily(date: string): boolean {
    return existsSync(join(this.folder(), dailyFileName(date)));
  }

  hasRollup(period: RollupPeriod, rangeStart: string): boolean {
    return existsSync(join(this.folder(), rollupFileName(period, rangeStart)));
  }

  private write(fileName: string, content: string): VaultWriteResult {
    const folder = this.folder();
    mkdirSync(folder, { recursive: true });
    const path = join(folder, fileName);
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, content, 'utf8');
    renameSync(tmp, path);
    this.logger.info({ fileName }, 'vault write done');
    return { fileName, path };
  }
}
