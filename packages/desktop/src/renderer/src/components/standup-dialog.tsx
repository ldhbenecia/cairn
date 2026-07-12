import { motion } from 'framer-motion';
import { Check, Copy, Loader2, MessageSquareText, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RecentListResult } from '../cairn-api';
import { buildStandupText, pickStandupSource } from '../lib/standup';
import { useSettings } from '../settings-context';

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function StandupDialog({
  recent,
  onClose,
}: {
  recent: RecentListResult | null;
  onClose: () => void;
}) {
  const { t } = useSettings();
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  // 페이지당 1회만 생성 — recent 목록 갱신(포커스 리로드·발행 완료)마다 source 참조가 바뀌어
  // 재생성되면 textarea 의 사용자 편집이 덮인다
  const builtFor = useRef<string | null>(null);
  const mounted = useRef(true);

  const source = useMemo(() => pickStandupSource(recent?.pages ?? [], todayLocal()), [recent]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 자체 오버레이(Radix 아님)라 ESC 닫기를 직접 — 다른 다이얼로그와 동작 통일
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      // IME 조합 취소(ESC)는 다이얼로그 닫기가 아니다 — 편집 중 유실 방지
      if (e.isComposing || e.keyCode === 229) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!source || builtFor.current === source.pageId) return;
    builtFor.current = source.pageId;
    setFailed(false);
    void window.cairn
      .pageContent(source.pageId, source.workspaceLabel)
      .then((c) => {
        // stale 응답 가드 — source 가 그새 다른 페이지로 바뀌었으면 버린다
        if (!mounted.current || builtFor.current !== source.pageId) return;
        setText(
          buildStandupText(c.blocks, source.date ?? '', {
            yesterday: t('standup.yesterday'),
            today: t('standup.today'),
            blockers: t('standup.blockers'),
            none: t('standup.none'),
          }),
        );
      })
      .catch(() => {
        if (mounted.current && builtFor.current === source.pageId) setFailed(true);
      });
  }, [source, t]);

  function copy() {
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <motion.div
      onPointerDown={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 [-webkit-app-region:no-drag]"
    >
      <motion.div
        onPointerDown={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -4 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel w-[560px] max-w-[92vw] overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <MessageSquareText size={15} strokeWidth={2} className="text-ink-tertiary" />
              {t('standup.title')}
            </p>
            {source?.date && (
              <p className="mt-0.5 font-mono text-[11.5px] text-ink-tertiary">
                {t('standup.basedOn').replace('{date}', source.date)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t('drawer.close')}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 py-4">
          {!source ? (
            <p className="py-10 text-center text-[13px] text-ink-tertiary">{t('standup.empty')}</p>
          ) : failed ? (
            <p className="py-10 text-center text-[13px] text-ink-tertiary">{t('standup.failed')}</p>
          ) : text === null ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-ink-tertiary">
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
              {t('standup.loading')}
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              className="h-[260px] w-full resize-none rounded-md border border-hairline bg-surface-2 p-3 font-mono text-[12.5px] leading-relaxed text-ink outline-none focus:border-accent/50"
            />
          )}
        </div>

        {text !== null && (
          <div className="flex justify-end border-t border-hairline px-5 py-3.5">
            <button
              type="button"
              onClick={copy}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
                copied
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-hairline bg-surface-2 text-ink hover:bg-surface-3'
              }`}
            >
              {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
              {copied ? t('standup.copied') : t('standup.copy')}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
