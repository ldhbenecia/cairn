import { Module } from '@nestjs/common';
import { CairnModule } from './cairn/cairn.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { GithubModule } from './github/github.module.js';
import { LocalGitModule } from './local-git/local-git.module.js';
import { LoggingModule } from './logging/logging.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { NotionModule } from './notion/notion.module.js';
import { SecretsModule } from './secrets/secrets.module.js';
import { SummarizerModule } from './summarizer/summarizer.module.js';
import { WorklogConfigModule } from './worklog-config/worklog-config.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    SecretsModule,
    WorklogConfigModule,
    GithubModule,
    LocalGitModule,
    NotionModule,
    SummarizerModule,
    NotificationModule,
    CairnModule,
  ],
})
export class AppModule {}
