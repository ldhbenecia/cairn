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
            className="inline-flex h-10 items-center gap-3 rounded-[4px] border border-[#747775] bg-white px-3 font-medium text-[#1f1f1f] transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]"
            style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontSize: 14 }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.4673-.806 5.9564-2.1818l-2.9087-2.2581c-.806.54-1.8368.8586-3.0477.8586-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"
              />
              <path
                fill="#EA4335"
                d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
              />
            </svg>
            Google 계정으로 로그인
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
