import { Module } from '@nestjs/common';
import { SecretsModule } from '../secrets/secrets.module.js';
import { WorklogConfigModule } from '../worklog-config/worklog-config.module.js';
import { NotionApiClient } from './notion-api.client.js';
import { NotionPublisherService } from './notion-publisher.service.js';
import { NotionRollupApiClient } from './notion-rollup-api.client.js';

@Module({
  imports: [WorklogConfigModule, SecretsModule],
  providers: [NotionApiClient, NotionRollupApiClient, NotionPublisherService],
  exports: [NotionApiClient, NotionRollupApiClient, NotionPublisherService],
})
export class NotionModule {}
