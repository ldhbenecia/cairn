import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CairnError } from '../common/error.js';
import { GithubCollectorService } from '../github/github-collector.service.js';
import { LocalGitCollectorService } from '../local-git/local-git-collector.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { NotionCollectorService } from '../notion/notion-collector.service.js';
import {
  NotionPublisherService,
  type PublishWorklogResult,
} from '../notion/notion-publisher.service.js';
import { DailySummarizerService } from '../summarizer/daily-summarizer.service.js';
import type { RunOptions, RunSource } from './run-options.js';

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly githubCollector: GithubCollectorService,
    private readonly localGitCollector: LocalGitCollectorService,
    private readonly notionCollector: NotionCollectorService,
    private readonly notionPublisher: NotionPublisherService,
    private readonly summarizer: DailySummarizerService,
    private readonly notification: NotificationService,
    @InjectPinoLogger(OrchestratorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async run(options: RunOptions): Promise<void> {
    this.logger.info({ options }, 'orchestrator.run start');

    if (options.mode === 'daily') {
      try {
        await this.runDaily(options);
      } catch (err) {
        const error = CairnError.from(err, 'config');
        this.logger.error({ options, error }, 'orchestrator.run failed');
        await this.notification.notify(
          'cairn 실패',
          `${options.date} 일지 생성 실패 — ${error.message.slice(0, 120)}`,
        );
        throw err;
      }
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
      this.logger.warn({ sources: options.sources }, 'daily: no enabled source — skipping');
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

    const prCount = githubActivity?.prs.length ?? 0;
    const commitCount = localGitActivity?.repos.reduce((acc, r) => acc + r.commitCount, 0) ?? 0;
    const notionPageCount =
      notionActivity?.workspaces.reduce((acc, w) => acc + w.pageCount, 0) ?? 0;

    if (prCount + commitCount + notionPageCount === 0) {
      this.logger.info(
        { date: options.date },
        'daily: no activity collected — skipping summarizer + publisher',
      );
      await this.notification.notify('cairn 일지', `${options.date} 활동 없음 — 일지 생략`);
      return;
    }

    const summary = await this.summarizer.summarize({
      date: options.date,
      github: githubActivity,
      localGit: localGitActivity,
      notion: notionActivity,
    });

    const result = await this.notionPublisher.publish({
      date: options.date,
      force: options.force,
      github: githubActivity,
      localGit: localGitActivity,
      notion: notionActivity,
      summary,
    });

    this.logger.info(
      {
        date: options.date,
        prCount,
        commitCountTotal: commitCount,
        notionPageCountTotal: notionPageCount,
        summarizerOk: !!summary,
        publishResult: result,
      },
      'daily: publish done',
    );

    await this.notify(options.date, result, {
      prCount,
      commitCount,
      notionPageCount,
      summarizerOk: !!summary,
    });
  }

  private async notify(
    date: string,
    result: PublishWorklogResult,
    counts: {
      prCount: number;
      commitCount: number;
      notionPageCount: number;
      summarizerOk: boolean;
    },
  ): Promise<void> {
    const counts_label = `gh:${counts.prCount} / git:${counts.commitCount} / notion:${counts.notionPageCount}`;
    const summary_tag = counts.summarizerOk ? '' : ' [요약 실패]';

    if (result.kind === 'created') {
      await this.notification.notify('cairn 일지', `${date} 발행 (${counts_label})${summary_tag}`);
    } else if (result.kind === 'recreated') {
      await this.notification.notify(
        'cairn 일지',
        `${date} 재발행 (${counts_label})${summary_tag}`,
      );
    } else if (result.kind === 'skipped') {
      await this.notification.notify(
        'cairn 일지',
        `${date} skip — ${result.reason} (--force 로 재생성)`,
      );
    } else if (result.kind === 'no-target') {
      await this.notification.notify(
        'cairn 설정 필요',
        `${date} 발행 대상 없음 — worklog.config.json 의 worklog.pageId 또는 token 확인`,
      );
    }
  }
}

function wantsSource(sources: RunOptions['sources'], source: RunSource): boolean {
  return sources === 'all' || sources.includes(source);
}
