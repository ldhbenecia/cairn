import type { ReactNode } from 'react';

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
        'py-5 transition-opacity first:pt-0 last:pb-0',
        stacked ? 'flex flex-col gap-3' : 'flex items-start justify-between gap-6',
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
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={[
            'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-accent text-white' : 'text-ink-subtle hover:text-ink-muted',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
