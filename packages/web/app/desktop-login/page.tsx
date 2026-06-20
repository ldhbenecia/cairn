'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';

type Phase = 'loading' | 'signin' | 'bridging' | 'done' | 'error';

export default function DesktopLogin() {
  const { data: session, isPending } = authClient.useSession();
  const [phase, setPhase] = useState<Phase>('loading');
  const [port, setPort] = useState<string | null>(null);

  useEffect(() => {
    setPort(new URLSearchParams(window.location.search).get('port'));
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      setPhase('signin');
      return;
    }
    if (!port) {
      setPhase('done');
      return;
    }
    setPhase('bridging');
    void authClient.oneTimeToken
      .generate()
      .then((res) => {
        const token = res.data?.token;
        if (!token) {
          setPhase('error');
          return;
        }
        window.location.href = `http://127.0.0.1:${port}/?token=${encodeURIComponent(token)}`;
      })
      .catch(() => setPhase('error'));
  }, [isPending, session, port]);

  const signIn = (): void => {
    void authClient.signIn.social({ provider: 'google', callbackURL: window.location.href });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-[20px] font-semibold tracking-[-0.02em]">cairn</h1>
      {phase === 'loading' && <p className="text-[14px] text-ink-subtle">…</p>}
      {phase === 'signin' && (
        <>
          <p className="text-[14px] text-ink-subtle">데스크톱 앱 동기화를 위해 로그인하세요.</p>
          <button
            type="button"
            onClick={signIn}
            className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Google 로 로그인
          </button>
        </>
      )}
      {phase === 'bridging' && (
        <p className="text-[14px] text-ink-subtle">cairn 앱으로 돌아가는 중…</p>
      )}
      {phase === 'done' && (
        <p className="text-[14px] text-ink-subtle">
          {session?.user.email} 로 로그인됨. 이제 cairn 앱으로 돌아가도 됩니다.
        </p>
      )}
      {phase === 'error' && (
        <p className="text-[14px] text-[#f87171]">토큰 발급에 실패했어요. 다시 시도해 주세요.</p>
      )}
    </main>
  );
}
