import 'reflect-metadata';
import 'dotenv/config';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { parseCliArgs, parsePeriodDocArgs } from './cairn/cli-args.js';
import { OrchestratorService } from './cairn/orchestrator.service.js';
import { accumulateAgentUsage } from './common/agent-usage.js';
import { claudeExecutableOptions } from './common/claude-executable.js';
import { CairnError } from './common/error.js';
import { summaryModelOption } from './common/summary-model.js';
import { PeriodDocService } from './period-doc/period-doc.service.js';

// 요약과 같은 모델로 검사해야 probe 통과가 곧 발행 가능을 뜻함
async function probeClaude(): Promise<void> {
  let reason: string;
  try {
    const q = query({
      prompt: 'Reply with the single word: ok',
      options: { maxTurns: 1, ...summaryModelOption(), ...claudeExecutableOptions() },
    });
    const { resultSubtype } = await accumulateAgentUsage(q);
    if (resultSubtype === 'success') {
      process.stdout.write('CLAUDE_OK\n');
      process.exit(0);
    }
    reason = resultSubtype;
  } catch (err) {
    reason = CairnError.from(err, 'summarizer').message;
  }
  process.stdout.write(`CLAUDE_FAIL ${reason.replace(/\s+/g, ' ')}\n`);
  process.exit(2);
}

async function bootstrap(): Promise<void> {
  if (process.argv.includes('--probe-claude')) {
    await probeClaude();
    return;
  }
  const argv = process.argv.slice(2);
  const periodDoc = argv.includes('--period-doc') ? parsePeriodDocArgs(argv) : null;
  const options = periodDoc ? null : parseCliArgs(argv);

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  try {
    if (periodDoc) await app.get(PeriodDocService).generate(periodDoc);
    else await app.get(OrchestratorService).run(options!);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err: unknown) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write(`cairn bootstrap failed: ${msg}\n`);
  process.exit(1);
});
