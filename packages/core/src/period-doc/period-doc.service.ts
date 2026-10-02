import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { WorklogLang } from '../cairn/run-options.js';
import { CairnError } from '../common/error.js';
import { emitParentEvent } from '../common/parent-events.js';
import { runSubmitAgent } from '../common/submit-agent.js';
import { JournalSourceService } from '../journal/journal-source.service.js';
import { JournalWriterService } from '../journal/journal-writer.service.js';
import { parseSummaryFromBlocks } from '../rollup/rollup-collector.service.js';
import { WorklogStatsService } from '../worklog-stats/worklog-stats.service.js';
import { periodDocSystemPrompt } from './period-doc-prompt.js';
import {
  buildPeriodDocPayload,
  buildPeriodDocTools,
  periodDocFileName,
  renderPeriodDocMarkdown,
  type PeriodDocMetrics,
} from './period-doc-tools.js';

export interface PeriodDocOptions {
  since: string;
  until: string;
  lang: WorklogLang;
}

@Injectable()
export class PeriodDocService {
  constructor(
    private readonly journalSource: JournalSourceService,
    private readonly writer: JournalWriterService,
    private readonly stats: WorklogStatsService,
    @InjectPinoLogger(PeriodDocService.name)
    private readonly logger: PinoLogger,
  ) {}

  async generate({ since, until, lang }: PeriodDocOptions): Promise<void> {
    const entries = this.journalSource.listDailyEntries(since, until);
    const days = entries.map((e) => ({
      date: e.date,
      done: parseSummaryFromBlocks(e.blocks)?.doneBullets ?? [],
    }));
    const metrics: PeriodDocMetrics = {
      journalCount: entries.length,
      ...this.statsBetween(since, until),
    };
    const { payload, dropped } = buildPeriodDocPayload({
      rangeStart: since,
      rangeEnd: until,
      metrics,
      days,
    });
    if (dropped > 0) {
      this.logger.warn({ dropped }, 'period-doc: forbidden-pattern bullets dropped');
    }
    if (payload.days.length === 0) {
      this.logger.info({ since, until }, 'period-doc: no done bullets in range');
      emitParentEvent({ type: 'period-doc-empty' });
      return;
    }

    this.logger.info({ since, until, days: payload.days.length }, 'period-doc summarizer start');
    const { server, getSubmission } = buildPeriodDocTools();
    const run = await runSubmitAgent({
      prompt: ['<activity>', JSON.stringify(payload), '</activity>'].join('\n'),
      systemPrompt: periodDocSystemPrompt(lang),
      server,
      toolName: 'submit_period_doc',
      getSubmission,
    });
    if (run.lateError) {
      this.logger.warn({ error: run.lateError }, 'period-doc threw after submission');
    }
    const { submission } = run;
    const { model } = run.usage;
    if (!submission) {
      throw new CairnError('summarizer', 'unknown', 'period-doc ended without submit_period_doc');
    }

    const fileName = periodDocFileName(since, until);
    this.writer.writePeriodDoc(
      fileName,
      renderPeriodDocMarkdown({ since, until, lang, metrics, submission, model }),
    );
    emitParentEvent({ type: 'period-doc-written', fileName });
  }

  private statsBetween(since: string, until: string): { prCount: number; commitCount: number } {
    const totals = { prCount: 0, commitCount: 0 };
    for (const [key, stat] of Object.entries(this.stats.readAll())) {
      if (!key.startsWith('daily:')) continue;
      const date = key.slice('daily:'.length);
      if (date < since || date > until) continue;
      totals.prCount += stat.pr;
      totals.commitCount += stat.commit;
    }
    return totals;
  }
}
