import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { GithubCollectorService } from '../github/github-collector.service.js';
import { LocalGitCollectorService } from '../local-git/local-git-collector.service.js';
import { NotionCollectorService } from '../notion/notion-collector.service.js';
import type { RunOptions, RunSource } from './run-options.js';

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly githubCollector: GithubCollectorService,
    private readonly localGitCollector: LocalGitCollectorService,
    private readonly notionCollector: NotionCollectorService,
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
    const wantsGithub = wantsSource(options.sources, 'github');
    const wantsLocalGit = wantsSource(options.sources, 'local-git');
    const wantsNotion = wantsSource(options.sources, 'notion');

    if (!wantsGithub && !wantsLocalGit && !wantsNotion) {
      this.logger.warn(
        { sources: options.sources },
        'daily: no enabled source — skipping (publisher not implemented yet)',
      );
      return;
    }

    const [githubActivity, localGitActivity, notionActivity] = await Promise.all([
      wantsGithub ? this.githubCollector.collect(options.date) : Promise.resolve(null),
      wantsLocalGit ? this.localGitCollector.collect(options.date) : Promise.resolve(null),
      wantsNotion ? this.notionCollector.collect(options.date) : Promise.resolve(null),
    ]);

    if (options.dryRun) {
      if (githubActivity) {
        process.stdout.write('--- github activity (dry-run) ---\n');
        process.stdout.write(JSON.stringify(githubActivity, null, 2));
        process.stdout.write('\n');
      }
      if (localGitActivity) {
        process.stdout.write('--- local-git activity (dry-run) ---\n');
        process.stdout.write(JSON.stringify(localGitActivity, null, 2));
        process.stdout.write('\n');
      }
      if (notionActivity) {
        process.stdout.write('--- notion activity (dry-run) ---\n');
        process.stdout.write(JSON.stringify(notionActivity, null, 2));
        process.stdout.write('\n');
      }
      return;
    }

    this.logger.info(
      {
        prCount: githubActivity?.prs.length ?? 0,
        repoCount: localGitActivity?.repos.length ?? 0,
        commitCountTotal: localGitActivity?.repos.reduce((acc, r) => acc + r.commitCount, 0) ?? 0,
        notionWorkspaceCount: notionActivity?.workspaces.length ?? 0,
        notionPageCountTotal:
          notionActivity?.workspaces.reduce((acc, w) => acc + w.pageCount, 0) ?? 0,
      },
      'daily: activity collected (publisher not implemented yet)',
    );
  }
}

function wantsSource(sources: RunOptions['sources'], source: RunSource): boolean {
  return sources === 'all' || sources.includes(source);
}
