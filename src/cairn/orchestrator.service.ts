import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { RunOptions } from './run-options.js';

@Injectable()
export class OrchestratorService {
  constructor(
    @InjectPinoLogger(OrchestratorService.name)
    private readonly logger: PinoLogger,
  ) {}

  run(options: RunOptions): Promise<void> {
    this.logger.info({ options }, 'orchestrator.run start');
    this.logger.warn(
      { mode: options.mode, date: options.date, sources: options.sources },
      `${options.mode} mode: collectors not registered yet (skeleton only)`,
    );
    this.logger.info({ options }, 'orchestrator.run done');
    return Promise.resolve();
  }
}
