import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';

@Injectable()
export class SecretsService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  githubToken(): string | undefined {
    return this.config.get('GITHUB_TOKEN', { infer: true });
  }

  anthropicOauthToken(): string | undefined {
    return this.config.get('ANTHROPIC_OAUTH_TOKEN', { infer: true });
  }

  getEnv(name: string): string | undefined {
    const value = process.env[name];
    return value && value.length > 0 ? value : undefined;
  }

  requireGithubToken(): string {
    return this.requireOne(this.githubToken(), 'GITHUB_TOKEN');
  }

  requireAnthropicOauthToken(): string {
    return this.requireOne(this.anthropicOauthToken(), 'ANTHROPIC_OAUTH_TOKEN');
  }

  requireEnv(name: string): string {
    return this.requireOne(this.getEnv(name), name);
  }

  private requireOne(value: string | undefined, name: string): string {
    if (!value) {
      throw new Error(`Missing required secret: ${name}`);
    }
    return value;
  }
}
