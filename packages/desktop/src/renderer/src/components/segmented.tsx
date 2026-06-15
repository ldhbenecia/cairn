type Opt<T extends string | number> = { value: T; label: string };

// 슬라이딩 인디케이터 세그먼트 컨트롤 — 선택 시 알약이 부드럽게 이동.
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly Opt<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div className="relative flex rounded-lg bg-surface-2 p-1">
      <div
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-md bg-accent shadow-sm shadow-accent/30 transition-transform duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${idx * 100}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`relative z-10 flex-1 rounded-md px-2 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed ${
            value === o.value ? 'text-white' : 'text-ink-subtle hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
