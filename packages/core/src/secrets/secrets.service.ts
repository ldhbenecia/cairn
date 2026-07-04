import { Injectable } from '@nestjs/common';

@Injectable()
export class SecretsService {
  getEnv(name: string): string | undefined {
    const value = process.env[name];
    return value && value.length > 0 ? value : undefined;
  }
}
