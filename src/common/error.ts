export const ErrorSource = {
  Github: 'github',
  LocalGit: 'local-git',
  Notion: 'notion',
  Summarizer: 'summarizer',
  Config: 'config',
  Unknown: 'unknown',
} as const;
export type ErrorSource = (typeof ErrorSource)[keyof typeof ErrorSource];

export const ErrorCode = {
  AuthFailed: 'auth_failed',
  Forbidden: 'forbidden',
  NotFound: 'not_found',
  RateLimited: 'rate_limited',
  ServerError: 'server_error',
  BadRequest: 'bad_request',
  Network: 'network',
  Validation: 'validation',
  Unknown: 'unknown',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface CairnErrorJson {
  source: ErrorSource;
  code: ErrorCode | (string & {});
  status?: number;
  message: string;
}

export class CairnError extends Error {
  constructor(
    readonly source: ErrorSource,
    readonly code: ErrorCode | (string & {}),
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'CairnError';
  }

  toJSON(): CairnErrorJson {
    return { source: this.source, code: this.code, status: this.status, message: this.message };
  }

  static from(reason: unknown, source: ErrorSource): CairnError {
    if (reason instanceof CairnError) return reason;
    if (isNotionApiError(reason)) {
      return new CairnError(source, reason.code, reason.message, reason.status);
    }
    if (isHttpStatusError(reason)) {
      return new CairnError(source, codeFromStatus(reason.status), reason.message, reason.status);
    }
    if (reason instanceof Error) {
      const code = reason.message.startsWith('Missing required secret:')
        ? ErrorCode.AuthFailed
        : ErrorCode.Unknown;
      return new CairnError(source, code, reason.message);
    }
    return new CairnError(source, ErrorCode.Unknown, errorMessage(reason));
  }

  static gitRepoNotFound(): CairnError {
    return new CairnError(ErrorSource.LocalGit, ErrorCode.NotFound, 'not a git repository');
  }

  static gitEmailMissing(): CairnError {
    return new CairnError(
      ErrorSource.LocalGit,
      ErrorCode.Validation,
      'git config user.email is empty',
    );
  }

  static notionTokenMissing(envVar: string): CairnError {
    return new CairnError(ErrorSource.Notion, ErrorCode.AuthFailed, `env var ${envVar} is empty`);
  }

  static githubTokenMissing(envVar: string): CairnError {
    return new CairnError(ErrorSource.Github, ErrorCode.AuthFailed, `env var ${envVar} is empty`);
  }
}

export function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

function isNotionApiError(
  v: unknown,
): v is { object: 'error'; status: number; code: string; message: string } {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    o.object === 'error' &&
    typeof o.status === 'number' &&
    typeof o.code === 'string' &&
    typeof o.message === 'string'
  );
}

function isHttpStatusError(v: unknown): v is Error & { status: number } {
  return v instanceof Error && typeof (v as { status?: unknown }).status === 'number';
}

function codeFromStatus(status: number): ErrorCode {
  if (status === 401) return ErrorCode.AuthFailed;
  if (status === 403) return ErrorCode.Forbidden;
  if (status === 404) return ErrorCode.NotFound;
  if (status === 429) return ErrorCode.RateLimited;
  if (status >= 500) return ErrorCode.ServerError;
  if (status >= 400) return ErrorCode.BadRequest;
  return ErrorCode.Unknown;
}
