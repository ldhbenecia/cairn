import { Global, Module } from '@nestjs/common';
import { SecretsService } from './secrets.service.js';

@Global()
@Module({
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SecretsModule {}
