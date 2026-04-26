import { Module } from '@nestjs/common';
import { GithubApiClient } from './github-api.client.js';

@Module({
  providers: [GithubApiClient],
  exports: [GithubApiClient],
})
export class GithubModule {}
