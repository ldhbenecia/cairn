import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../settings-context';

type Props = {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
};

type PageItem = number | 'dots';

function generatePages(total: number, current: number, maxVisible: number): PageItem[] {
  if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i + 1);
  // current 주변 고정 폭 창 — 양 끝에선 창을 밀어 폭을 유지(시작/끝에서 버튼이 줄던 버그)
  const delta = Math.max(1, Math.floor((maxVisible - 5) / 2));
  let start = current - delta;
  let end = current + delta;
  if (start < 2) {
    end += 2 - start;
    start = 2;
  }
  if (end > total - 1) {
    start -= end - (total - 1);
    end = total - 1;
  }
  start = Math.max(2, start);
  end = Math.min(total - 1, end);

  const range = [1];
  for (let i = start; i <= end; i++) range.push(i);
  range.push(total);

  const pages: PageItem[] = [];
  let prev = 0;
  for (const p of range) {
    if (prev) {
      if (p - prev === 2) pages.push(prev + 1);
      else if (p - prev > 1) pages.push('dots');
    }
    pages.push(p);
    prev = p;
  }
  return pages;
}

export function Pagination({ totalPages, currentPage, onPageChange, maxVisiblePages = 7 }: Props) {
  const { t } = useSettings();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [underline, setUnderline] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const btn = btnRefs.current[currentPage];
    const track = trackRef.current;
    if (!btn || !track) return;
    const b = btn.getBoundingClientRect();
    const p = track.getBoundingClientRect();
    setUnderline({ left: b.left - p.left, width: b.width });
  }, [currentPage, totalPages]);

  const pages = generatePages(totalPages, currentPage, maxVisiblePages);

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label={t('onb.nav.prev')}
        className="flex size-7 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft size={14} strokeWidth={2} />
      </button>

      <div ref={trackRef} className="relative flex items-center gap-0.5">
        {pages.map((pg, i) =>
          pg === 'dots' ? (
            <span key={`dots-${i}`} className="px-1.5 text-[12px] text-ink-tertiary select-none">
              …
            </span>
          ) : (
            <button
              key={pg}
              type="button"
              ref={(el) => {
                btnRefs.current[pg] = el;
              }}
              onClick={() => onPageChange(pg)}
              aria-current={pg === currentPage ? 'page' : undefined}
              className={[
                'rounded-md px-2.5 py-1 font-mono text-[12px] tabular-nums transition-colors',
                pg === currentPage
                  ? 'font-semibold text-ink'
                  : 'text-ink-tertiary hover:text-ink-muted',
              ].join(' ')}
            >
              {pg}
            </button>
          ),
        )}
        <motion.div
          initial={false}
          animate={{ left: underline.left, width: underline.width }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-ink"
        />
      </div>

      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label={t('onb.nav.next')}
        className="flex size-7 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
