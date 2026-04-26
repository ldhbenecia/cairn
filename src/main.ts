import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import 'reflect-metadata';
import { AppModule } from './app.module.js';
import { parseCliArgs } from './cairn/cli-args.js';
import { OrchestratorService } from './cairn/orchestrator.service.js';

async function bootstrap(): Promise<void> {
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
