import { Module } from '@nestjs/common';
import { SecretsModule } from '../secrets/secrets.module.js';
import { WorklogConfigModule } from '../worklog-config/worklog-config.module.js';
import { NotionApiClient } from './notion-api.client.js';
import { NotionCollectorService } from './notion-collector.service.js';

@Module({
  imports: [WorklogConfigModule, SecretsModule],
  providers: [NotionApiClient, NotionCollectorService],
  exports: [NotionApiClient, NotionCollectorService],
})
export class NotionModule {}
