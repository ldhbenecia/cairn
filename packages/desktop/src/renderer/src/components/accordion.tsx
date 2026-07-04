import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Plus } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';

export function Accordion({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-hairline">{children}</div>;
}

export function AccordionItem({
  open,
  onToggle,
  header,
  disabled,
  icon = 'chevron',
  'aria-label': ariaLabel,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  header: ReactNode;
  disabled?: boolean;
  icon?: 'chevron' | 'plus';
  'aria-label'?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md">
      {/* header 안에 버튼 중첩 가능해야 해서 button 대신 div+role */}
      <div
        {...(!disabled
          ? {
              role: 'button' as const,
              tabIndex: 0,
              onClick: onToggle,
              onKeyDown: (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggle();
                }
              },
              'aria-expanded': open,
              'aria-label': ariaLabel,
            }
          : {})}
        className={[
          'flex items-center rounded-md px-2 py-1.5 text-[13px]',
          disabled ? '' : 'transition-colors hover:bg-surface-2/60',
        ].join(' ')}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">{header}</div>
        {!disabled &&
          (icon === 'plus' ? (
            <Plus
              size={13}
              strokeWidth={2}
              className={`ml-1 shrink-0 text-ink-tertiary transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
            />
          ) : (
            <ChevronDown
              size={13}
              strokeWidth={2}
              className={`ml-1 shrink-0 text-ink-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          ))}
      </div>
      <AnimatePresence initial={false}>
        {open && !disabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
