import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppConfigService } from '../config/app-config.service.js';
import {
  worklogConfigSchema,
  type NotionWorkspaceConfig,
  type WorklogConfig,
} from './worklog-config.schema.js';

const DEFAULT_FILENAME = 'worklog.config.json';
const EMPTY_CONFIG: WorklogConfig = { localGitRepos: [], notionWorkspaces: [] };

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
      {
        path,
        localGitRepoCount: this.cached.localGitRepos.length,
        notionWorkspaceCount: this.cached.notionWorkspaces.length,
      },
      'worklog config loaded',
    );
    return this.cached;
  }

  getLocalGitRepos(): readonly string[] {
    return this.load().localGitRepos;
  }

  getNotionWorkspaces(): readonly NotionWorkspaceConfig[] {
    return this.load().notionWorkspaces;
  }

  persistWorklogTarget(
    workspaceLabel: string,
    ids: { databaseId: string; dataSourceId: string },
  ): void {
    const { config, path } = this.readForPersist('persistWorklogTarget');

    let matched = false;
    const next: WorklogConfig = {
      ...config,
      notionWorkspaces: config.notionWorkspaces.map((ws) => {
        if (ws.label !== workspaceLabel) return ws;
        matched = true;
        return {
          ...ws,
          worklog: { ...ws.worklog, databaseId: ids.databaseId, dataSourceId: ids.dataSourceId },
        };
      }),
    };

    if (!matched) {
      throw new Error(`persistWorklogTarget: workspace ${workspaceLabel} not found in config`);
    }

    this.writePersist(path, next);
    this.logger.info(
      { workspace: workspaceLabel, kind: 'worklog', ...ids, path },
      'worklog config: worklog.databaseId / dataSourceId 자동 저장',
    );
  }

  persistRollupTarget(
    workspaceLabel: string,
    ids: { databaseId: string; dataSourceId: string },
  ): void {
    const { config, path } = this.readForPersist('persistRollupTarget');

    let matched = false;
    const next: WorklogConfig = {
      ...config,
      notionWorkspaces: config.notionWorkspaces.map((ws) => {
        if (ws.label !== workspaceLabel) return ws;
        matched = true;
        return {
          ...ws,
          rollup: { ...ws.rollup, databaseId: ids.databaseId, dataSourceId: ids.dataSourceId },
        };
      }),
    };

    if (!matched) {
      throw new Error(`persistRollupTarget: workspace ${workspaceLabel} not found in config`);
    }

    this.writePersist(path, next);
    this.logger.info(
      { workspace: workspaceLabel, kind: 'rollup', ...ids, path },
      'worklog config: rollup.databaseId / dataSourceId 자동 저장',
    );
  }

  private readForPersist(caller: string): { config: WorklogConfig; path: string } {
    const path = this.resolvePath();
    if (!existsSync(path)) {
      throw new Error(`${caller}: config not found at ${path}`);
    }
    const raw = readFileSync(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return { config: worklogConfigSchema.parse(parsed), path };
  }

  private writePersist(path: string, next: WorklogConfig): void {
    writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    this.cached = next;
  }

  private resolvePath(): string {
    const override = this.appConfig.cairnConfigPath;
    if (override) return resolve(override);
    return resolve(process.cwd(), DEFAULT_FILENAME);
  }
}
