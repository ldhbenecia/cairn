import { z } from 'zod';

// .loose(): worklog.config.json 의 tokenEnv 가 가리키는 자유 이름 env 가
// ConfigModule.validate 로 strip 되지 않도록
export const envSchema = z.looseObject({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  ANTHROPIC_OAUTH_TOKEN: z.string().optional(),

  CAIRN_CONFIG_PATH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
