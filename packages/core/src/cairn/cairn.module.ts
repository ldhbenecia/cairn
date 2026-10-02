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
    // AppModule 직접 import 는 LoggingModule 평가 뒤라 @InjectPinoLogger 컨텍스트가 등록 안 된다
    PeriodDocModule,
  ],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class CairnModule {}
