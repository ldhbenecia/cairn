import { Module } from '@nestjs/common';
import { GithubApiClient } from './github-api.client.js';
import { GithubCollectorService } from './github-collector.service.js';

@Module({
  providers: [GithubApiClient, GithubCollectorService],
  exports: [GithubApiClient, GithubCollectorService],
})
export class GithubModule {}
