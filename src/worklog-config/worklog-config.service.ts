import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppConfigService } from '../config/app-config.service.js';
import { worklogConfigSchema, type WorklogConfig } from './worklog-config.schema.js';

const DEFAULT_FILENAME = 'worklog.config.json';
const EMPTY_CONFIG: WorklogConfig = { localGitRepos: [] };

@Injectable()
export class WorklogConfigService {
  private cached: WorklogConfig | undefined;

  constructor(
    private readonly appConfig: AppConfigService,
    @InjectPinoLogger(WorklogConfigService.name)
    private readonly logger: PinoLogger,
  ) {}

  load(): WorklogConfig {
    if (this.cached) return this.cached;

    const path = this.resolvePath();
    if (!existsSync(path)) {
      this.logger.warn({ path }, 'worklog.config.json not found — using empty config');
      this.cached = EMPTY_CONFIG;
      return this.cached;
    }

    const raw = readFileSync(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    this.cached = worklogConfigSchema.parse(parsed);
    this.logger.info(
      { path, localGitRepoCount: this.cached.localGitRepos.length },
      'worklog config loaded',
    );
    return this.cached;
  }

  getLocalGitRepos(): readonly string[] {
    return this.load().localGitRepos;
  }

  private resolvePath(): string {
    const override = this.appConfig.cairnConfigPath;
    if (override) return resolve(override);
    return resolve(process.cwd(), DEFAULT_FILENAME);
  }
}
