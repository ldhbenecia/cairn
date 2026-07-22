import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppConfigService } from '../config/app-config.service.js';
import { withFileLock } from '../common/file-lock.js';
import {
  worklogConfigSchema,
  type GithubAccountConfig,
  type NotionWorkspaceConfig,
  type WorklogConfig,
} from './worklog-config.schema.js';

const DEFAULT_FILENAME = 'worklog.config.json';
const EMPTY_CONFIG: WorklogConfig = {
  localGitEnabled: false,
  localGitRepos: [],
  notionWorkspaces: [],
  githubAccounts: [],
};

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

  isLocalGitEnabled(): boolean {
    return this.load().localGitEnabled;
  }

  getNotionWorkspaces(): readonly NotionWorkspaceConfig[] {
    return this.load().notionWorkspaces;
  }

  // target 워크스페이스 선택은 여기 한 곳으로 — 수집/발행이 서로 다른 predicate 로
  // 다른 워크스페이스를 고르면 교차 발행이 생긴다. databaseId 만 설정한 구성도 유효
  // (resolveDatabaseAndDataSource 가 databaseId-only 를 지원).
  findWorklogWorkspace(): NotionWorkspaceConfig | undefined {
    return this.getNotionWorkspaces().find((ws) => ws.worklog?.pageId ?? ws.worklog?.databaseId);
  }

  findRollupWorkspace(): NotionWorkspaceConfig | undefined {
    return this.getNotionWorkspaces().find(
      (ws) =>
        ws.rollup?.pageId ?? ws.rollup?.databaseId ?? ws.worklog?.pageId ?? ws.worklog?.databaseId,
    );
  }

  getGithubAccounts(): readonly GithubAccountConfig[] {
    return this.load().githubAccounts;
  }

  persistWorklogTarget(
    workspaceLabel: string,
    ids: { databaseId: string; dataSourceId: string },
  ): void {
    this.persistTarget('worklog', workspaceLabel, ids);
  }

  persistRollupTarget(
    workspaceLabel: string,
    ids: { databaseId: string; dataSourceId: string },
  ): void {
    this.persistTarget('rollup', workspaceLabel, ids);
  }

  private persistTarget(
    kind: 'worklog' | 'rollup',
    workspaceLabel: string,
    ids: { databaseId: string; dataSourceId: string },
  ): void {
    const caller = `persistTarget(${kind})`;
    const path = this.resolvePath();
    withFileLock(path, () => {
      const { config } = this.readForPersist(caller);
      let matched = false;
      const next: WorklogConfig = {
        ...config,
        notionWorkspaces: config.notionWorkspaces.map((ws) => {
          if (ws.label !== workspaceLabel) return ws;
          matched = true;
          return {
            ...ws,
            [kind]: { ...ws[kind], databaseId: ids.databaseId, dataSourceId: ids.dataSourceId },
          };
        }),
      };
      if (!matched) {
        throw new Error(`${caller}: workspace ${workspaceLabel} not found in config`);
      }
      this.writePersist(path, next);
    });
    this.logger.info(
      { workspace: workspaceLabel, kind, ...ids, path },
      `worklog config: ${kind}.databaseId / dataSourceId 자동 저장`,
    );
  }

  private readForPersist(caller: string): { config: WorklogConfig } {
    const path = this.resolvePath();
    if (!existsSync(path)) {
      throw new Error(`${caller}: config not found at ${path}`);
    }
    const raw = readFileSync(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return { config: worklogConfigSchema.parse(parsed) };
  }

  private writePersist(path: string, next: WorklogConfig): void {
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    renameSync(tmp, path);
    this.cached = next;
  }

  private resolvePath(): string {
    const override = this.appConfig.cairnConfigPath;
    if (override) return resolve(override);
    return resolve(process.cwd(), DEFAULT_FILENAME);
  }
}
