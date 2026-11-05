import { CairnError, ErrorCode } from './error.js';

// 요약 엔진(Claude·Codex) 실패를 만들어지는 곳에서 코드로 분류 — 데스크톱은 문구가 아닌 code 로 안내를 고름
// 엔진마다 문구가 달라 패턴은 여기 한 곳에만 둠
const AUTH =
  /OAuth (token|session).*(expired|revoked)|Please run \/login|authentication_error|Failed to authenticate|not logged in|log ?in (again|required)|unauthorized|\b401\b/i;
const RATE = /rate.?limit|session limit|usage limit|quota|\b429\b/i;

export function engineError(err: unknown): CairnError {
  const e = CairnError.from(err, 'summarizer');
  if (e.code !== ErrorCode.Unknown) return e;
  const code = AUTH.test(e.message)
    ? ErrorCode.AuthFailed
    : RATE.test(e.message)
      ? ErrorCode.RateLimited
      : ErrorCode.Unknown;
  return code === ErrorCode.Unknown ? e : new CairnError(e.source, code, e.message, e.status);
}
