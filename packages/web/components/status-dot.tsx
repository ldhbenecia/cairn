'use client';

import { useEffect, useState } from 'react';

export function StatusDot({ ok, fail }: { ok: string; fail: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');

  useEffect(() => {
    let alive = true;
    fetch('/api/health')
      .then((r) => {
        if (alive) setState(r.ok ? 'ok' : 'fail');
      })
      .catch(() => {
        if (alive) setState('fail');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'loading') return null;

  return (
    <span className="flex items-center gap-1.5 text-[12px] text-ink-tertiary">
      <span
        className={`size-1.5 shrink-0 rounded-full ${state === 'ok' ? 'bg-emerald-400' : 'bg-ink-tertiary'}`}
        aria-hidden="true"
      />
      {state === 'ok' ? ok : fail}
    </span>
  );
}

// Anthropic 공개 status API — indicator 'none' 만 정상, 그 외는 이상, fetch 실패는 확인 불가.
// status.anthropic.com 은 status.claude.com 으로 302 (redirect 응답에 CORS 헤더가 없어
// 브라우저 fetch 가 실패) — 최종 도메인을 직접 호출한다
export function ClaudeStatusDot({
  ok,
  issues,
  unknown,
}: {
  ok: string;
  issues: string;
  unknown: string;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'issues' | 'unknown'>('loading');

  useEffect(() => {
    let alive = true;
    fetch('https://status.claude.com/api/v2/status.json')
      .then((r) => (r.ok ? (r.json() as Promise<{ status?: { indicator?: string } }>) : null))
      .then((j) => {
        if (!alive) return;
        if (!j) setState('unknown');
        else setState(j.status?.indicator === 'none' ? 'ok' : 'issues');
      })
      .catch(() => {
        if (alive) setState('unknown');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'loading') return null;

  const dot =
    state === 'ok' ? 'bg-emerald-400' : state === 'issues' ? 'bg-amber-400' : 'bg-ink-tertiary';
  const label = state === 'ok' ? ok : state === 'issues' ? issues : unknown;

  return (
    <span className="flex items-center gap-1.5 text-[12px] text-ink-tertiary">
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
