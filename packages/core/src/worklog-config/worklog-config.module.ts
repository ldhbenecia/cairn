import { Module } from '@nestjs/common';
import { WorklogConfigService } from './worklog-config.service.js';

@Module({
  providers: [WorklogConfigService],
  exports: [WorklogConfigService],
})
export class WorklogConfigModule {}
