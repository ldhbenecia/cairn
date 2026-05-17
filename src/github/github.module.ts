import { Module } from '@nestjs/common';
import { SecretsModule } from '../secrets/secrets.module.js';
import { WorklogConfigModule } from '../worklog-config/worklog-config.module.js';
import { GithubApiClient } from './github-api.client.js';
import { GithubCollectorService } from './github-collector.service.js';

@Module({
  imports: [SecretsModule, WorklogConfigModule],
  providers: [GithubApiClient, GithubCollectorService],
  exports: [GithubApiClient, GithubCollectorService],
})
export class GithubModule {}
