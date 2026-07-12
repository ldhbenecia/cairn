import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, PenLine } from 'lucide-react';
import { translate, type I18nKey } from './i18n';
import { applyAccent, applyGlass, applyTheme } from './settings-context';
import './styles.css';

// bootstrap 설정 고정 렌더 — 설정 변경 시 main 이 창 파기
const lang = window.cairn.initialSettings.language;
const t = (key: I18nKey): string => translate(lang, key);

applyTheme(window.cairn.initialSettings.theme);
applyAccent(window.cairn.initialSettings.accent);
applyGlass(window.cairn.initialSettings.liquidGlass);

function Capture() {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedTimer = useRef<number | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    const onFocus = (): void => inputRef.current?.focus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      // IME 조합 취소 ESC 제외
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
    if (!trimmed || saving.current) return;
    saving.current = true;
    try {
      const r = await window.cairn.capture.add(trimmed);
      if (!r.ok) return;
      setText('');
      setSaved(true);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => {
        setSaved(false);
        void window.cairn.capture.hide();
      }, 700);
    } catch {
      /* 입력 보존 — 재시도 가능 */
    } finally {
      saving.current = false;
    }
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
          maxLength={300}
          onChange={(e) => {
            setText(e.target.value);
            // 플래시 중 타이핑 시 자동 숨김 취소
            if (savedTimer.current) {
              window.clearTimeout(savedTimer.current);
              savedTimer.current = null;
            }
            if (saved) setSaved(false);
          }}
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
