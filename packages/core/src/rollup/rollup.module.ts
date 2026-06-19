import { Module } from '@nestjs/common';
import { NotionModule } from '../notion/notion.module.js';
import { SecretsModule } from '../secrets/secrets.module.js';
import { WorklogConfigModule } from '../worklog-config/worklog-config.module.js';
import { WorklogStatsModule } from '../worklog-stats/worklog-stats.module.js';
import { RollupCollectorService } from './rollup-collector.service.js';
import { RollupPublisherService } from './rollup-publisher.service.js';
import { RollupSummarizerService } from './rollup-summarizer.service.js';

@Module({
  imports: [WorklogConfigModule, SecretsModule, NotionModule, WorklogStatsModule],
  providers: [RollupCollectorService, RollupSummarizerService, RollupPublisherService],
  exports: [RollupCollectorService, RollupSummarizerService, RollupPublisherService],
})
export class RollupModule {}
