import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from '../config/app-config.module.js';
import { AppConfigService } from '../config/app-config.service.js';

const REDACT_PATHS = [
  '*.token',
  '*.api_key',
  '*.apiKey',
  '*.access_token',
  '*.accessToken',
  '*.refresh_token',
  '*.refreshToken',
  '*.password',
  '*.secret',
  '*.authorization',
  'headers.authorization',
  'headers["x-api-key"]',
  'env.GITHUB_TOKEN',
  'env.NOTION_TOKEN',
  'env.ANTHROPIC_OAUTH_TOKEN',
];

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          base: { machine: config.machineName },
          redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
          timestamp: () => `,"time":"${new Date().toISOString()}"`,
          transport: config.isProduction
            ? undefined
            : {
                target: 'pino-pretty',
                options: { colorize: true, singleLine: false, translateTime: 'SYS:HH:MM:ss.l' },
              },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
