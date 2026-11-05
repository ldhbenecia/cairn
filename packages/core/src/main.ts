import 'reflect-metadata';
import 'dotenv/config';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { z } from 'zod';
import { AppModule } from './app.module.js';
import { parseCliArgs, parsePeriodDocArgs } from './cairn/cli-args.js';
import { OrchestratorService } from './cairn/orchestrator.service.js';
import { accumulateAgentUsage } from './common/agent-usage.js';
import { isolatedAgentOptions } from './common/agent-isolation.js';
import { claudeExecutableOptions } from './common/claude-executable.js';
import { runCodexSubmitAgent } from './common/codex-submit-agent.js';
import { CairnError } from './common/error.js';
import { emitParentEvent } from './common/parent-events.js';
import { summaryModelOption } from './common/summary-model.js';
import { summaryProvider } from './common/summary-provider.js';
import { PeriodDocService } from './period-doc/period-doc.service.js';

// 요약과 같은 provider·모델·격리 옵션으로 검사해야 probe 통과가 곧 발행 가능을 뜻함
async function probeClaude(): Promise<string | null> {
  const q = query({
    prompt: 'Reply with the single word: ok',
    options: {
      maxTurns: 1,
      ...summaryModelOption(),
      ...claudeExecutableOptions(),
      ...isolatedAgentOptions(),
    },
  });
  const { resultSubtype } = await accumulateAgentUsage(q);
  return resultSubtype === 'success' ? null : resultSubtype;
}

async function probeCodex(): Promise<string | null> {
  const { submission } = await runCodexSubmitAgent({
    serverName: 'cairn-probe',
    toolName: 'submit_probe',
    toolDescription: 'Submit the probe reply.',
    schema: z.object({ reply: z.string() }),
    systemPrompt: 'Answer in JSON.',
    prompt: 'Set reply to the single word: ok',
  });
  return submission ? null : 'no_submission';
}

async function probeSummarizer(): Promise<void> {
  let reason: string | null;
  try {
    reason = summaryProvider() === 'codex' ? await probeCodex() : await probeClaude();
  } catch (err) {
    reason = CairnError.from(err, 'summarizer').message;
  }
  if (reason === null) {
    process.stdout.write('PROBE_OK\n');
    process.exit(0);
  }
  process.stdout.write(`PROBE_FAIL ${reason.replace(/\s+/g, ' ')}\n`);
  process.exit(2);
}

async function bootstrap(): Promise<void> {
  if (process.argv.includes('--probe-summarizer')) {
    await probeSummarizer();
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
  if (err instanceof CairnError) {
    emitParentEvent({ type: 'failure', source: err.source, code: err.code });
  }
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write(`cairn bootstrap failed: ${msg}\n`);
  process.exit(1);
});
