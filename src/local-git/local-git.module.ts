import { Module } from '@nestjs/common';
import { WorklogConfigModule } from '../worklog-config/worklog-config.module.js';
import { LocalGitCollectorService } from './local-git-collector.service.js';
import { LocalGitClient } from './local-git.client.js';

@Module({
  imports: [WorklogConfigModule],
  providers: [LocalGitClient, LocalGitCollectorService],
  exports: [LocalGitClient, LocalGitCollectorService],
})
export class LocalGitModule {}
