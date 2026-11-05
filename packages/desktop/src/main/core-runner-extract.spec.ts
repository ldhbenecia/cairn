import { describe, expect, it } from 'vitest';
import {
  applyParentEvent,
  createExtractor,
  hintFromFailure,
  parseParentEvent,
} from './core-runner-extract';

const PID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

describe('createExtractor — failureHint (stdout 의 남은 유일한 용도)', () => {
  it('auth 패턴 라인이면 auth', () => {
    const ext = createExtractor();
    ext.feed('{"error":{"code":"auth_failed"},"msg":"github account failed"}');
    expect(ext.failureHint).toBe('auth');
  });
  it('구체 원인이 뒤에 와도 일반 증상(network)을 이긴다', () => {
    const ext = createExtractor();
    ext.feed('ETIMEDOUT while fetching');
    ext.feed('rate_limited later');
    expect(ext.failureHint).toBe('quota');
  });
  it('같은 순위면 첫 매치 유지, 낮은 순위는 덮지 못한다', () => {
    const ext = createExtractor();
    ext.feed('{"msg":"github: Bad credentials"}');
    ext.feed('fetch failed');
    expect(ext.failureHint).toBe('auth');
  });
  it('요약 엔진 로그인 만료는 failure 이벤트로 engine-auth — 뒤따르는 일반 요약 실패보다 우선', () => {
    const ext = createExtractor();
    applyParentEvent(ext, { type: 'failure', source: 'summarizer', code: 'auth_failed' });
    applyParentEvent(ext, { type: 'failure', source: 'summarizer', code: 'unknown' });
    ext.feed('{"msg":"rollup: summary generation failed — aborting publish"}');
    expect(ext.failureHint).toBe('engine-auth');
  });
  it('failure 이벤트의 (source, code) 를 안내 키로', () => {
    expect(hintFromFailure('summarizer', 'rate_limited')).toBe('quota');
    expect(hintFromFailure('github', 'auth_failed')).toBe('auth');
    expect(hintFromFailure('notion', 'validation_error')).toBe('notion');
    expect(hintFromFailure('local-git', 'not_found')).toBe('collect');
    expect(hintFromFailure('summarizer', 'forbidden')).toBe('summarize');
    expect(hintFromFailure('config', 'unknown')).toBeNull();
  });
  it('failure 이벤트를 파싱', () => {
    expect(
      parseParentEvent({ cairn: 1, type: 'failure', source: 'summarizer', code: 'auth_failed' }),
    ).toEqual({
      type: 'failure',
      source: 'summarizer',
      code: 'auth_failed',
    });
    expect(parseParentEvent({ cairn: 1, type: 'failure', source: 1 })).toBeNull();
  });
  it('롤업 요약 실패 라인은 summarize', () => {
    const ext = createExtractor();
    ext.feed('{"msg":"rollup: summary generation failed — aborting publish"}');
    expect(ext.failureHint).toBe('summarize');
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
