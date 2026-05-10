import { Module } from '@nestjs/common';
import { NotionModule } from '../notion/notion.module.js';
import { SecretsModule } from '../secrets/secrets.module.js';
import { WorklogConfigModule } from '../worklog-config/worklog-config.module.js';
import { RollupCollectorService } from './rollup-collector.service.js';
import { RollupSummarizerService } from './rollup-summarizer.service.js';

@Module({
  imports: [WorklogConfigModule, SecretsModule, NotionModule],
  providers: [RollupCollectorService, RollupSummarizerService],
  exports: [RollupCollectorService, RollupSummarizerService],
})
export class RollupModule {}
