import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { OrchestratorService } from './orchestrator.service.js';

@Module({
  imports: [GithubModule],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class CairnModule {}
