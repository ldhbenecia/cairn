import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CairnError } from '../common/error.js';
import type {
  NotionActivity,
  NotionPageEdit,
  NotionWorkspaceActivity,
} from '../contracts/notion-activity.types.js';
import { kstDateToUtcWindow } from '../github/date-window.js';
import { SecretsService } from '../secrets/secrets.service.js';
import type { NotionWorkspaceConfig } from '../worklog-config/worklog-config.schema.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import { NotionApiClient } from './notion-api.client.js';
import type { RawNotionPage } from './notion-api.types.js';

const MAX_SEARCH_PAGES = 50;

@Injectable()
export class NotionCollectorService {
  constructor(
    private readonly client: NotionApiClient,
    private readonly worklogConfig: WorklogConfigService,
    private readonly secrets: SecretsService,
    @InjectPinoLogger(NotionCollectorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async collect(date: string): Promise<NotionActivity> {
    const window = kstDateToUtcWindow(date);
    const workspaceConfigs = this.worklogConfig.getNotionWorkspaces();

    if (workspaceConfigs.length === 0) {
      this.logger.warn('no notionWorkspaces configured — empty activity');
      return {
        date,
        rangeStart: window.startIso,
        rangeEnd: window.endIso,
        workspaces: [],
      };
    }

    this.logger.info(
      {
        date,
        workspaceCount: workspaceConfigs.length,
        since: window.startIso,
        until: window.endIso,
      },
      'notion collect start',
    );

    const settled = await Promise.allSettled(
      workspaceConfigs.map((cfg) => this.collectWorkspace(cfg, window.startIso, window.endIso)),
    );

    const workspaces: NotionWorkspaceActivity[] = settled.map((result, idx) => {
      if (result.status === 'fulfilled') return result.value;
      const cfg = workspaceConfigs[idx];
      const label = cfg?.label ?? 'unknown';
      const error = CairnError.from(result.reason, 'notion');
      this.logger.warn({ workspace: label, error }, 'notion workspace failed');
      return { workspace: label, pageCount: 0, pages: [], error };
    });

    this.logger.info(
      {
        date,
        workspaceCount: workspaces.length,
        pageCountTotal: workspaces.reduce((acc, w) => acc + w.pageCount, 0),
      },
      'notion collect done',
    );

    return { date, rangeStart: window.startIso, rangeEnd: window.endIso, workspaces };
  }

  private async collectWorkspace(
    cfg: NotionWorkspaceConfig,
    sinceIso: string,
    untilIso: string,
  ): Promise<NotionWorkspaceActivity> {
    const token = this.secrets.getEnv(cfg.tokenEnv);
    if (!token) {
      return {
        workspace: cfg.label,
        pageCount: 0,
        pages: [],
        error: CairnError.notionTokenMissing(cfg.tokenEnv),
      };
    }

    const selfReferentialIds = new Set<string>(
      [cfg.worklog?.databaseId, cfg.worklog?.dataSourceId].filter(
        (id): id is string => typeof id === 'string',
      ),
    );

    const pages: NotionPageEdit[] = [];
    let cursor: string | undefined;

    for (let i = 0; i < MAX_SEARCH_PAGES; i++) {
      const { pages: batch, nextCursor } = await this.client.searchPages(token, {
        startCursor: cursor,
        pageSize: 100,
      });

      let reachedBeforeWindow = false;
      for (const raw of batch) {
        if (raw.lastEditedTime > untilIso) continue;
        if (raw.lastEditedTime < sinceIso) {
          reachedBeforeWindow = true;
          break;
        }
        if (raw.lastEditedById !== cfg.myUserId) continue;
        if (raw.parentId && selfReferentialIds.has(raw.parentId)) continue;
        pages.push(toEdit(raw));
      }

      if (reachedBeforeWindow) break;
      if (!nextCursor) break;
      cursor = nextCursor;
    }

    return { workspace: cfg.label, pageCount: pages.length, pages };
  }
}

function toEdit(raw: RawNotionPage): NotionPageEdit {
  return {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    lastEditedAt: raw.lastEditedTime,
    parentType: raw.parentType,
  };
}
