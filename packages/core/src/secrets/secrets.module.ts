import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { SecretsService } from './secrets.service.js';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SecretsModule {}
