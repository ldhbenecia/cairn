import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Check, TriangleAlert, X } from 'lucide-react';
import type { CoreMode, CoreResult } from '../cairn-api';
import { useSettings } from '../settings-context';

export type RunToastData = { mode: CoreMode; result: CoreResult; at: number };

// 발행 종료를 앱 안에서도 인지시키는 토스트 — macOS 알림은 포커스 상태에서 배너가 억제됨
export function RunToast({
  toast,
  onClose,
  onOpenPage,
}: {
  toast: RunToastData | null;
  onClose: () => void;
  onOpenPage: (pageId: string, url: string | null) => void;
}) {
  const { t } = useSettings();
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-[70] [-webkit-app-region:no-drag]">
      <AnimatePresence>
        {toast &&
          (() => {
            const { mode, result } = toast;
            const ok = result.ok && !result.summaryFailed;
            const url = result.notionUrl;
            const hasCounts = ok && (result.prCount > 0 || result.commitCount > 0);
            return (
              <motion.div
                key={toast.at}
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="glass-panel pointer-events-auto flex w-80 items-center gap-3 rounded-lg border border-hairline bg-surface-1 p-3.5 shadow-2xl shadow-black/40"
              >
                <span
                  className={[
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    ok ? 'bg-emerald-500/12 text-emerald-400' : 'bg-rose-500/12 text-rose-400',
                  ].join(' ')}
                >
                  {ok ? (
                    <Check size={15} strokeWidth={2.5} />
                  ) : (
                    <TriangleAlert size={15} strokeWidth={2} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">
                    {t(`nav.${mode}`)} {ok ? t('toast.done') : t('toast.fail')}
                  </p>
                  {hasCounts && (
                    <p className="font-mono text-[11.5px] text-ink-tertiary tabular-nums">
                      PR {result.prCount} · {t('publish.collected.commits')} {result.commitCount}
                    </p>
                  )}
                </div>
                {ok && result.publishPageId && (
                  <button
                    type="button"
                    title={t('publish.viewInApp')}
                    onClick={() => onOpenPage(result.publishPageId!, url)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <BookOpen size={14} strokeWidth={2} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </motion.div>
            );
          })()}
      </AnimatePresence>
    </div>
  );
}
