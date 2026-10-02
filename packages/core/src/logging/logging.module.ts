import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from '../config/app-config.module.js';
import { AppConfigService } from '../config/app-config.service.js';

const LOG_FILE_BASE = resolve(homedir(), '.cairn', 'logs', 'cairn');

// packaged 앱에서 fork 되면 pino-pretty·pino-roll worker thread 가 bundle 안 경로를 못 잡아 transport 없이 JSON stdout
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
  '*.*.headers.authorization',
  // 실제 키는 GITHUB_TOKEN_<LABEL> 형태라 고정 이름으로는 안 잡히고, pino redact 는 부분 이름
  // 와일드카드가 없어 env 값 전체를 가림
  'env.*',
];

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        // pnpm workspace isolation 으로 worker thread 가 모듈명을 못 찾아 절대 경로 명시 — packaged 는 CJS bundle 이라 import.meta.url 이 없어 skip
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
