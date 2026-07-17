import type { ReactNode } from 'react';

export function Section({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between pb-1.5">
        <p className="text-[11px] font-medium tracking-wider text-ink-tertiary uppercase">
          {label}
        </p>
        {action}
      </div>
      <div className="divide-y divide-hairline">{children}</div>
    </section>
  );
}

export function Field({
  label,
  desc,
  children,
  stacked = false,
  dim = false,
}: {
  label: string;
  desc?: string;
  children: ReactNode;
  stacked?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={[
        'py-3 transition-opacity',
        stacked ? 'flex flex-col gap-3' : 'flex items-center justify-between gap-6',
        dim ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {desc && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-tertiary">{desc}</p>}
      </div>
      {stacked ? children : <div className="shrink-0">{children}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  grow = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  grow?: boolean;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={[
            'rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors',
            grow ? 'flex-1' : '',
            value === o.value ? 'bg-surface-3 text-ink' : 'text-ink-subtle hover:text-ink-muted',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
