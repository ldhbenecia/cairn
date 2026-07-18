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
