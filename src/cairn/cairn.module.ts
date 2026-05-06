import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { LocalGitModule } from '../local-git/local-git.module.js';
import { OrchestratorService } from './orchestrator.service.js';

@Module({
  imports: [GithubModule, LocalGitModule],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class CairnModule {}
