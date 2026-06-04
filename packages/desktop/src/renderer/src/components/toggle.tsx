type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
};

export function Toggle({ checked, onChange, disabled, label }: Props) {
  return (
    <label
      className={[
        'inline-flex select-none items-center gap-3 text-[13px] text-ink-muted',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-hairline-strong',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block size-[14px] rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[14px]' : 'translate-x-[2px]',
          ].join(' ')}
        />
      </button>
      {label && <span>{label}</span>}
    </label>
  );
}
