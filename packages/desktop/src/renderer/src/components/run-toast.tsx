import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Check, Minus, TriangleAlert, X } from 'lucide-react';
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
            // '활동 없음/skip/대상 없음' 을 초록 '발행 완료' 로 오보하지 않도록 결과 종류 구분
            const kind =
              !result.ok || result.summaryFailed
                ? ('fail' as const)
                : result.noActivity
                  ? ('noActivity' as const)
                  : result.publishKind === 'skipped'
                    ? ('skipped' as const)
                    : result.publishKind === 'no-target'
                      ? result.journalFile
                        ? ('localDone' as const)
                        : ('noTarget' as const)
                      : ('done' as const);
            const ok = kind === 'done' || kind === 'localDone';
            const neutral = kind === 'noActivity' || kind === 'skipped' || kind === 'noTarget';
            const url = result.notionUrl;
            const hasCounts = ok && (result.prCount > 0 || result.commitCount > 0);
            const failHint =
              kind === 'fail' && result.failureHint
                ? (`fail.${result.failureHint}` as const)
                : null;
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
                    ok
                      ? 'bg-success/12 text-success'
                      : neutral
                        ? 'bg-surface-2 text-ink-tertiary'
                        : 'bg-danger/12 text-danger',
                  ].join(' ')}
                >
                  {ok ? (
                    <Check size={15} strokeWidth={2.5} />
                  ) : neutral ? (
                    <Minus size={15} strokeWidth={2.25} />
                  ) : (
                    <TriangleAlert size={15} strokeWidth={2} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">
                    {t(`nav.${mode}`)}{' '}
                    {kind === 'done'
                      ? t('toast.done')
                      : kind === 'fail'
                        ? t('toast.fail')
                        : t(`toast.${kind}`)}
                  </p>
                  {failHint && (
                    <p className="text-[11.5px] leading-snug text-ink-tertiary">{t(failHint)}</p>
                  )}
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
                  aria-label={t('drawer.close')}
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
