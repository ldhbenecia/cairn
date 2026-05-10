import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { LocalGitModule } from '../local-git/local-git.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { NotionModule } from '../notion/notion.module.js';
import { RollupModule } from '../rollup/rollup.module.js';
import { SummarizerModule } from '../summarizer/summarizer.module.js';
import { OrchestratorService } from './orchestrator.service.js';

@Module({
  imports: [
    GithubModule,
    LocalGitModule,
    NotionModule,
    SummarizerModule,
    NotificationModule,
    RollupModule,
  ],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class CairnModule {}
