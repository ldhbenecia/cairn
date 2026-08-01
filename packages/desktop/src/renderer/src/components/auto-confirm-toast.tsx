import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock } from 'lucide-react';
import type { CoreMode } from '../cairn-api';
import { useSettings } from '../settings-context';

// confirmBeforeRun 의 인앱 확인 배너 — macOS 는 앱이 프론트일 때 표시된 알림 배너의 click 을
// 전달하지 않아(electron#51885) 알림만으로는 발행 확인이 막힐 수 있다
export function AutoConfirmToast({
  modes,
  onAccept,
  onDismiss,
}: {
  modes: CoreMode[] | null;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const { t } = useSettings();
  return (
    <AnimatePresence>
      {modes && modes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel pointer-events-auto fixed right-5 bottom-5 z-50 flex w-96 max-w-[calc(100vw-40px)] items-center gap-3 rounded-lg border border-hairline bg-surface-1 p-3.5 shadow-2xl shadow-black/40"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-subtle">
            <CalendarClock size={15} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink">{t('autoConfirm.title')}</p>
            <p className="mt-0.5 truncate text-[12px] text-ink-tertiary">
              {modes.map((m) => t(`nav.${m}`)).join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-md px-2 py-1.5 text-[12.5px] text-ink-tertiary transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {t('autoConfirm.later')}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="shrink-0 rounded-md bg-accent px-2.5 py-1.5 text-[12.5px] font-medium text-white transition-[background-color,scale] hover:bg-accent-hover active:scale-[0.96]"
          >
            {t('autoConfirm.run')}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
