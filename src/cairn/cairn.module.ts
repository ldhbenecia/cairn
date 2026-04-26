import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service.js';

@Module({
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class CairnModule {}
