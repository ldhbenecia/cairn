import { spawn } from 'node:child_process';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppConfigService } from '../config/app-config.service.js';

@Injectable()
export class NotificationService {
  constructor(
    private readonly appConfig: AppConfigService,
    @InjectPinoLogger(NotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async notify(title: string, message: string): Promise<void> {
    if (process.platform !== 'darwin') {
      this.logger.debug({ title }, 'notification skipped — non-darwin platform');
      return;
    }
    if (!this.appConfig.isProduction) {
      this.logger.debug({ title }, 'notification skipped — non-production env');
      return;
    }

    const script = `display notification "${escape(message)}" with title "${escape(title)}"`;

    await new Promise<void>((res) => {
      const child = spawn('osascript', ['-e', script], { stdio: 'ignore' });
      child.once('error', (err) => {
        this.logger.warn({ err: err.message }, 'osascript spawn failed');
        res();
      });
      child.once('close', (code) => {
        if (code !== 0) {
          this.logger.warn({ code }, 'osascript exited non-zero');
        }
        res();
      });
    });
  }
}

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
