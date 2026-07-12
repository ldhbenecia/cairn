import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, PenLine } from 'lucide-react';
import { translate, type I18nKey } from './i18n';
import { applyAccent, applyTheme } from './settings-context';
import './styles.css';

// 캡처 창은 SettingsProvider 없이 bootstrap 설정으로 고정 렌더 — 언어 변경 시 main 이 창을 파기한다
const lang = window.cairn.initialSettings.language;
const t = (key: I18nKey): string => translate(lang, key);

applyTheme(window.cairn.initialSettings.theme);
applyAccent(window.cairn.initialSettings.accent);

function Capture() {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedTimer = useRef<number | null>(null);

  // 창이 다시 뜰 때마다 입력에 포커스
  useEffect(() => {
    const onFocus = (): void => inputRef.current?.focus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      // IME 조합 취소(ESC)는 창 닫기가 아니다
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      void window.cairn.capture.hide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(
    () => () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    },
    [],
  );

  async function submit(): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || saved) return;
    const r = await window.cairn.capture.add(trimmed);
    if (!r.ok) return;
    setText('');
    setSaved(true);
    savedTimer.current = window.setTimeout(() => {
      setSaved(false);
      void window.cairn.capture.hide();
    }, 700);
  }

  return (
    <div className="p-1">
      <div className="glass-panel flex items-center gap-2.5 rounded-xl border border-hairline bg-surface-1 px-4 py-3.5 shadow-2xl shadow-black/50">
        {saved ? (
          <Check size={15} strokeWidth={2.5} className="shrink-0 text-success" />
        ) : (
          <PenLine size={15} strokeWidth={2} className="shrink-0 text-ink-tertiary" />
        )}
        <input
          ref={inputRef}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            e.preventDefault();
            void submit();
          }}
          placeholder={t('capture.placeholder')}
          className="w-full appearance-none bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-tertiary focus:outline-none focus-visible:outline-none"
        />
        <span className="shrink-0 text-[11px] whitespace-nowrap text-ink-tertiary">
          {saved ? t('capture.saved') : t('capture.hint')}
        </span>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Capture />
  </StrictMode>,
);
