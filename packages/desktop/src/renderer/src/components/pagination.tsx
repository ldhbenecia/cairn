import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Props = {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
};

type PageItem = number | 'dots';

function generatePages(total: number, current: number, maxVisible: number): PageItem[] {
  if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i + 1);
  const side = 1;
  const middle = maxVisible - 2 * side - 2;
  const pages: PageItem[] = [1];
  let left = Math.max(current - Math.floor(middle / 2), side + 1);
  const right = Math.min(current + Math.floor(middle / 2), total - side);
  if (left > side + 1) pages.push('dots');
  else left = side + 1;
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - side) pages.push('dots');
  pages.push(total);
  return pages;
}

export function Pagination({ totalPages, currentPage, onPageChange, maxVisiblePages = 7 }: Props) {
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
          className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-accent"
        />
      </div>

      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="flex size-7 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
