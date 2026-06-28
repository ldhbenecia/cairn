import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class NotificationService {
  constructor(
    @InjectPinoLogger(NotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  notify(title: string, message: string): Promise<void> {
    this.logger.debug(
      { title, message },
      'engine OS notification suppressed — desktop owns notifications',
    );
    return Promise.resolve();
  }
}
