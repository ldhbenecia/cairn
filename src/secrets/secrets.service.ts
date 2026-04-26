import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';

@Injectable()
export class SecretsService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  githubToken(): string | undefined {
    return this.config.get('GITHUB_TOKEN', { infer: true });
  }

  notionToken(): string | undefined {
    return this.config.get('NOTION_TOKEN', { infer: true });
  }

  anthropicOauthToken(): string | undefined {
    return this.config.get('ANTHROPIC_OAUTH_TOKEN', { infer: true });
  }

  myNotionUserId(): string | undefined {
    return this.config.get('MY_NOTION_USER_ID', { infer: true });
  }

  requireGithubToken(): string {
    return this.requireOne(this.githubToken(), 'GITHUB_TOKEN');
  }

  requireNotionToken(): string {
    return this.requireOne(this.notionToken(), 'NOTION_TOKEN');
  }

  requireAnthropicOauthToken(): string {
    return this.requireOne(this.anthropicOauthToken(), 'ANTHROPIC_OAUTH_TOKEN');
  }

  requireMyNotionUserId(): string {
    return this.requireOne(this.myNotionUserId(), 'MY_NOTION_USER_ID');
  }

  private requireOne(value: string | undefined, name: string): string {
    if (!value) {
      throw new Error(`Missing required secret: ${name}`);
    }
    return value;
  }
}
