import { Module } from '@nestjs/common';
import { JournalModule } from '../journal/journal.module.js';
import { WorklogStatsModule } from '../worklog-stats/worklog-stats.module.js';
import { PeriodDocService } from './period-doc.service.js';

@Module({
  imports: [JournalModule, WorklogStatsModule],
  providers: [PeriodDocService],
  exports: [PeriodDocService],
})
export class PeriodDocModule {}
