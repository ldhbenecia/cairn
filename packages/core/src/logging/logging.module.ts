import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from '../config/app-config.module.js';
import { AppConfigService } from '../config/app-config.service.js';

const LOG_FILE_BASE = resolve(homedir(), '.cairn', 'logs', 'cairn');

// packaged Electron app 안에서 fork 되면 pino-pretty / pino-roll 의 worker thread 가 bundle 안의 path 못 잡음 → transport 없이 plain JSON stdout
const IS_PACKAGED = process.env.CAIRN_PACKAGED === 'true';

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
      useFactory: (config: AppConfigService) => {
        // pnpm workspace 의 isolation 으로 pino worker thread 가 module name resolve 실패 → 절대 경로 명시 (packaged 가 아닐 때만 — IS_PACKAGED 시 import.meta.url 이 CJS bundle 에서 undefined 라 createRequire 호출 자체 skip)
        const requireFromHere = IS_PACKAGED ? null : createRequire(import.meta.url);
        const transport = IS_PACKAGED
          ? undefined
          : config.isProduction
            ? {
                target: requireFromHere!.resolve('pino-roll'),
                options: {
                  file: LOG_FILE_BASE,
                  frequency: 'daily',
                  mkdir: true,
                  extension: '.log',
                  dateFormat: 'yyyy-MM-dd',
                },
              }
            : {
                target: requireFromHere!.resolve('pino-pretty'),
                options: {
                  colorize: true,
                  singleLine: false,
                  translateTime: 'SYS:HH:MM:ss.l',
                  ignore: 'pid,hostname',
                },
              };
        return {
          pinoHttp: {
            level: 'info',
            redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
            timestamp: () => `,"time":"${new Date().toISOString()}"`,
            transport,
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
