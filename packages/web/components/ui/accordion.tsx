'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export interface AccordionItem {
  q: string;
  a: string;
}

export function Accordion({
  items,
  idPrefix = 'accordion',
}: {
  items: AccordionItem[];
  idPrefix?: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-surface-1">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                id={`${idPrefix}-trigger-${i}`}
                aria-expanded={open}
                aria-controls={`${idPrefix}-panel-${i}`}
                onClick={() => setOpenIndex(open ? null : i)}
                className={`flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[15px] font-medium transition-colors ${
                  open ? 'text-ink' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {item.q}
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 shrink-0 text-ink-tertiary transition-transform duration-300 ease-out ${
                    open ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </h3>
            <div
              id={`${idPrefix}-panel-${i}`}
              role="region"
              aria-labelledby={`${idPrefix}-trigger-${i}`}
              aria-hidden={!open}
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-5 text-[14px] leading-relaxed text-ink-subtle">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
