import { Module } from '@nestjs/common';
import { WorklogConfigModule } from '../worklog-config/worklog-config.module.js';
import { JournalSourceService } from './journal-source.service.js';
import { JournalWriterService } from './journal-writer.service.js';

@Module({
  imports: [WorklogConfigModule],
  providers: [JournalWriterService, JournalSourceService],
  exports: [JournalWriterService, JournalSourceService],
})
export class JournalModule {}
