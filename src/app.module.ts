import { Module } from '@nestjs/common';
import { CairnModule } from './cairn/cairn.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { GithubModule } from './github/github.module.js';
import { LoggingModule } from './logging/logging.module.js';
import { SecretsModule } from './secrets/secrets.module.js';

@Module({
  imports: [AppConfigModule, LoggingModule, SecretsModule, GithubModule, CairnModule],
})
export class AppModule {}
