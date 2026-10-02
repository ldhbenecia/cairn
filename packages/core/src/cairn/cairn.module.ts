import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { LocalGitModule } from '../local-git/local-git.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { NotionModule } from '../notion/notion.module.js';
import { PeriodDocModule } from '../period-doc/period-doc.module.js';
import { RollupModule } from '../rollup/rollup.module.js';
import { SummarizerModule } from '../summarizer/summarizer.module.js';
import { JournalModule } from '../journal/journal.module.js';
import { WorklogStatsModule } from '../worklog-stats/worklog-stats.module.js';
import { OrchestratorService } from './orchestrator.service.js';

@Module({
  imports: [
    GithubModule,
    LocalGitModule,
    NotionModule,
    SummarizerModule,
    NotificationModule,
    RollupModule,
    JournalModule,
    WorklogStatsModule,
    // AppModule 에서 직접 import 하면 LoggingModule 평가 뒤라 PinoLogger 컨텍스트 미등록 — 여기 둬야 함
    PeriodDocModule,
  ],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class CairnModule {}
