import { Module } from '@nestjs/common';
import { WorklogConfigModule } from '../worklog-config/worklog-config.module.js';
import { VaultWriterService } from './vault-writer.service.js';

@Module({
  imports: [WorklogConfigModule],
  providers: [VaultWriterService],
  exports: [VaultWriterService],
})
export class VaultModule {}
