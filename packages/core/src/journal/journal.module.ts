import { Module } from '@nestjs/common';
import { WorklogConfigModule } from '../worklog-config/worklog-config.module.js';
import { JournalWriterService } from './journal-writer.service.js';

@Module({
  imports: [WorklogConfigModule],
  providers: [JournalWriterService],
  exports: [JournalWriterService],
})
export class JournalModule {}
