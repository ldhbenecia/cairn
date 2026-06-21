'use client';

import { useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { CanvasRevealEffect } from '@/components/ui/sign-in-flow-1';

type Phase = 'loading' | 'signin' | 'bridging' | 'done' | 'error';

// port 는 순수 숫자만 허용 — `1@evil.com` 같은 값으로 loopback URL 의 호스트가
// 바뀌어 one-time token 이 외부로 새는 오픈 리다이렉트를 차단.
function readPort(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('port');
  const ok = raw && /^\d{1,5}$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 65535;
  return ok ? raw : null;
}

export default function DesktopLogin() {
  const { data: session, isPending } = authClient.useSession();
  const [port] = useState<string | null>(readPort);
  const [errored, setErrored] = useState(false);
  // one-time token 은 단일 사용 — StrictMode 재마운트·재렌더로 generate 가 중복 호출되지 않도록 1회 가드
  const bridged = useRef(false);

  let phase: Phase = 'loading';
  if (errored) phase = 'error';
  else if (isPending) phase = 'loading';
  else if (!session) phase = 'signin';
  else if (!port) phase = 'done';
  else phase = 'bridging';

  useEffect(() => {
    if (phase !== 'bridging' || !port || bridged.current) return;
    bridged.current = true;
    let cancelled = false;
    void authClient.oneTimeToken
      .generate()
      .then((res) => {
        if (cancelled) return;
        const token = res.data?.token;
        if (!token) {
          setErrored(true);
          return;
        }
        window.location.href = `http://127.0.0.1:${port}/?token=${encodeURIComponent(token)}`;
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });
    return () => {
      cancelled = true;
    };
  }, [phase, port]);

  const signIn = (): void => {
    void authClient.signIn.social({ provider: 'google', callbackURL: window.location.href });
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-black">
      {/* 셰이더 도트 배경 — 실제 OAuth 로직과 무관한 비주얼 레이어 */}
      <div className="absolute inset-0 z-0">
        <CanvasRevealEffect
          animationSpeed={3}
          containerClassName="bg-black"
          colors={[
            [255, 255, 255],
            [255, 255, 255],
          ]}
          dotSize={6}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,1)_0%,_transparent_100%)]" />
        <div className="absolute top-0 right-0 left-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
      </div>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <h1 className="text-[2rem] font-semibold tracking-tight text-white">cairn</h1>

        {phase === 'loading' && <p className="text-[14px] text-white/50">…</p>}

        {phase === 'signin' && (
          <>
            <p className="text-[14px] text-white/60">Sign in to sync your desktop app.</p>
            <button
              type="button"
              onClick={signIn}
              className="inline-flex h-11 items-center gap-3 rounded-full border border-[#747775] bg-white px-6 font-medium text-[#1f1f1f] transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]"
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
              Sign in with Google
            </button>
          </>
        )}

        {phase === 'bridging' && (
          <p className="text-[14px] text-white/60">Returning to the cairn app…</p>
        )}
        {phase === 'done' && (
          <p className="text-[14px] text-white/60">
            Signed in as {session?.user.email}. You can return to the cairn app now.
          </p>
        )}
        {phase === 'error' && (
          <p className="text-[14px] text-[#f87171]">Couldn’t issue a token. Please try again.</p>
        )}
      </main>
    </div>
  );
}
