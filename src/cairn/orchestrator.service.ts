import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { GithubCollectorService } from '../github/github-collector.service.js';
import type { RunOptions, RunSource } from './run-options.js';

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly githubCollector: GithubCollectorService,
    @InjectPinoLogger(OrchestratorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async run(options: RunOptions): Promise<void> {
    this.logger.info({ options }, 'orchestrator.run start');

    if (options.mode === 'daily') {
      await this.runDaily(options);
    } else {
      this.logger.warn(
        { mode: options.mode, date: options.date },
        `${options.mode} mode: rollup not implemented yet`,
      );
    }

    this.logger.info({ options }, 'orchestrator.run done');
  }

  private async runDaily(options: RunOptions): Promise<void> {
    if (!wantsSource(options.sources, 'github')) {
      this.logger.warn({ sources: options.sources }, 'daily: github source not enabled — skipping');
      return;
    }

    const githubActivity = await this.githubCollector.collect(options.date);

    if (options.dryRun) {
      process.stdout.write('--- github activity (dry-run) ---\n');
      process.stdout.write(JSON.stringify(githubActivity, null, 2));
      process.stdout.write('\n');
    } else {
      this.logger.info(
        { prCount: githubActivity.prs.length },
        'daily: github activity collected (publisher not implemented yet)',
      );
    }
  }
}

function wantsSource(sources: RunOptions['sources'], source: RunSource): boolean {
  return sources === 'all' || sources.includes(source);
}
