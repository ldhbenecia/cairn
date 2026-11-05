import { Loader2 } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import type { SummaryProvider } from '../../../shared/ipc-types';
import { useSettings } from '../settings-context';

type LoginState = 'idle' | 'waiting' | 'failed' | 'not-installed';

export interface EngineLogin {
  state: LoginState;
  start: () => void;
  cancel: () => void;
}

// 로그인 CLI 는 main 에서 최대 5분 살아 있음 — 팝오버가 닫혀 컴포넌트가 사라져도 진행 상태를 잃지 않도록 모듈 단위로 보관
const states: Record<SummaryProvider, LoginState> = { claude: 'idle', codex: 'idle' };
const cancelled: Record<SummaryProvider, boolean> = { claude: false, codex: false };
const listeners = new Set<() => void>();

function setState(provider: SummaryProvider, next: LoginState): void {
  states[provider] = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function startLogin(provider: SummaryProvider, onDone: () => void): void {
  if (states[provider] === 'waiting') return;
  cancelled[provider] = false;
  setState(provider, 'waiting');
  void window.cairn.engine
    .login(provider)
    .then((r) => {
      if (r.ok) {
        setState(provider, 'idle');
        onDone();
      } else if (cancelled[provider]) setState(provider, 'idle');
      else setState(provider, r.error === 'not-installed' ? 'not-installed' : 'failed');
    })
    .catch(() => setState(provider, 'failed'));
}

// CLI 로그인을 앱에서 띄움 — 브라우저 로그인이 끝나면 CLI 가 스스로 종료, 코드가 표시되는 경우만 입력칸으로 이어 줌
export function useEngineLogin(provider: SummaryProvider, onDone: () => void): EngineLogin {
  const state = useSyncExternalStore(subscribe, () => states[provider]);
  return {
    state,
    start: () => startLogin(provider, onDone),
    cancel: () => {
      cancelled[provider] = true;
      void window.cairn.engine.cancelLogin();
    },
  };
}

// 줄 오른쪽에 붙는 로그인 버튼 — 대기 중엔 스피너
export function EngineLoginButton({ login }: { login: EngineLogin }) {
  const { t } = useSettings();
  if (login.state === 'waiting') {
    return <Loader2 className="size-3.5 shrink-0 animate-spin text-ink-tertiary" />;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        login.start();
      }}
      className="shrink-0 rounded-md border border-hairline px-2 py-px text-[11.5px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {t('engine.login')}
    </button>
  );
}

// 줄 아래 — 로그인 대기 안내·코드 입력, 실패 사유
export function EngineLoginPanel({ login }: { login: EngineLogin }) {
  const { t } = useSettings();
  const [code, setCode] = useState('');
  const submit = (): void => {
    if (!code.trim()) return;
    void window.cairn.engine.submitCode(code);
    setCode('');
  };

  if (login.state === 'failed' || login.state === 'not-installed') {
    return (
      <p className="text-[11.5px] text-danger">
        {t(login.state === 'failed' ? 'engine.login.failed' : 'engine.login.notInstalled')}
      </p>
    );
  }
  if (login.state !== 'waiting') return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11.5px] leading-snug text-ink-tertiary">{t('engine.login.waiting')}</p>
      <div className="flex gap-1.5">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={t('engine.login.codePh')}
          aria-label={t('engine.login.codePh')}
          className="min-w-0 flex-1 rounded-md border border-hairline bg-surface-2 px-2 py-1 text-[11.5px] text-ink outline-none placeholder:text-ink-tertiary focus:border-hairline-strong"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!code.trim()}
          className="shrink-0 rounded-md border border-hairline px-2 py-1 text-[11.5px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        >
          {t('engine.login.submit')}
        </button>
        <button
          type="button"
          onClick={login.cancel}
          className="shrink-0 rounded-md px-1.5 py-1 text-[11.5px] text-ink-tertiary transition-colors hover:text-ink-muted"
        >
          {t('engine.login.cancel')}
        </button>
      </div>
    </div>
  );
}
