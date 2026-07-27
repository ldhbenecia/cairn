import { describe, expect, it } from 'vitest';
import { createExtractor } from './core-runner-extract';

const PID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

describe('createExtractor — failureHint (stdout 의 남은 유일한 용도)', () => {
  it('auth 패턴 라인이면 auth', () => {
    const ext = createExtractor();
    ext.feed('{"error":{"code":"auth_failed"},"msg":"github account failed"}');
    expect(ext.failureHint).toBe('auth');
  });
  it('첫 매치 라인의 힌트를 유지', () => {
    const ext = createExtractor();
    ext.feed('ETIMEDOUT while fetching');
    ext.feed('rate_limited later');
    expect(ext.failureHint).toBe('network');
  });
  it('매치 없으면 null', () => {
    const ext = createExtractor();
    ext.feed('nothing notable');
    expect(ext.failureHint).toBeNull();
  });
});

describe('createExtractor — 로그 스크래핑 제거 가드 (ADR 0033 3단계)', () => {
  it('결과 모양 로그 라인을 먹여도 상태가 변하지 않는다 — 결과는 fork-IPC 이벤트만 채운다', () => {
    const ext = createExtractor();
    ext.feed(`{"kind":"created","pageId":"${PID}","url":"https://www.notion.so/${PID}"}`);
    ext.feed('{"msg":"journal write done","fileName":"2026-07-25.md"}');
    ext.feed('{"date":"2026-07-25","msg":"daily: journal write failed"}');
    ext.feed('no activity collected — skipping');
    ext.feed('summary generation failed');
    expect(ext.lastKind).toBeNull();
    expect(ext.lastUrl).toBeNull();
    expect(ext.lastPageId).toBeNull();
    expect(ext.lastJournalFile).toBeNull();
    expect(ext.journalWriteFailed).toBe(false);
    expect(ext.noActivity).toBe(false);
    expect(ext.summaryFailed).toBe(false);
  });
});
