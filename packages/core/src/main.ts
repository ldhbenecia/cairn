import 'reflect-metadata';
import 'dotenv/config';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { parseCliArgs } from './cairn/cli-args.js';
import { OrchestratorService } from './cairn/orchestrator.service.js';
import { claudeExecutableOptions } from './common/claude-executable.js';

async function probeClaude(): Promise<void> {
  try {
    const q = query({
      prompt: 'Reply with the single word: ok',
      options: { maxTurns: 1, ...claudeExecutableOptions() },
    });
    let ok = false;
    for await (const message of q) {
      if (message.type === 'result') {
        ok = message.subtype === 'success';
        break;
      }
    }
    process.stdout.write(ok ? 'CLAUDE_OK\n' : 'CLAUDE_FAIL\n');
    process.exit(ok ? 0 : 2);
  } catch {
    process.stdout.write('CLAUDE_FAIL\n');
    process.exit(2);
  }
}

async function bootstrap(): Promise<void> {
  if (process.argv.includes('--probe-claude')) {
    await probeClaude();
    return;
  }
  const options = parseCliArgs(process.argv.slice(2));

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  try {
    const orchestrator = app.get(OrchestratorService);
    await orchestrator.run(options);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err: unknown) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write(`cairn bootstrap failed: ${msg}\n`);
  process.exit(1);
});
