import { Module } from '@nestjs/common';
import { WorklogStatsService } from './worklog-stats.service.js';

@Module({
  providers: [WorklogStatsService],
  exports: [WorklogStatsService],
})
export class WorklogStatsModule {}
