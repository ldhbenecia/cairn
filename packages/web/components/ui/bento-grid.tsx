'use client';

import { cn } from '@/lib/utils';

export interface BentoItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  status?: string;
  tags?: string[];
  meta?: string;
  colSpan?: number;
  hasPersistentHover?: boolean;
}

interface BentoGridProps {
  items: BentoItem[];
}

function BentoGrid({ items }: BentoGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            'group relative p-4 rounded-2xl overflow-hidden',
            'transition-[translate,border-color,box-shadow] duration-300',
            'border border-hairline bg-surface-1',
            'hover:border-hairline-strong hover:shadow-[0_4px_20px_rgba(0,0,0,0.25)]',
            'hover:-translate-y-0.5',
            item.colSpan === 2 ? 'md:col-span-2' : 'md:col-span-1',
            {
              'border-hairline-strong shadow-[0_4px_20px_rgba(0,0,0,0.25)] -translate-y-0.5':
                item.hasPersistentHover,
            },
          )}
        >
          <div
            className={`absolute inset-0 ${
              item.hasPersistentHover ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            } transition-opacity duration-300`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:4px_4px]" />
          </div>

          <div className="relative flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-2 transition-colors duration-300 group-hover:bg-accent/15">
                {item.icon}
              </div>
              <span
                className={cn(
                  'text-xs font-medium px-2 py-1 rounded-lg',
                  'bg-surface-2 text-ink-subtle',
                  'transition-colors duration-300 group-hover:bg-hairline',
                )}
              >
                {item.status || 'Active'}
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-ink tracking-tight text-[15px]">
                {item.title}
                {item.meta && (
                  <span className="ml-2 text-xs text-ink-tertiary font-normal">{item.meta}</span>
                )}
              </h3>
              <p className="text-sm text-ink-muted leading-snug font-[425]">{item.description}</p>
            </div>

            <div className="flex items-center mt-2">
              <div className="flex items-center space-x-2 text-xs text-ink-tertiary">
                {item.tags?.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-md bg-surface-2 transition-colors duration-200 hover:bg-hairline"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div
            className={`absolute inset-0 -z-10 rounded-2xl p-px bg-gradient-to-br from-transparent via-hairline to-transparent ${
              item.hasPersistentHover ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            } transition-opacity duration-300`}
          />
        </div>
      ))}
    </div>
  );
}

export { BentoGrid };
