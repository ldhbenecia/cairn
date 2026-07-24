type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  // 시각 라벨이 형제(Field/PanelRow)에 있어 switch 에 접근성 이름이 없다 — 호출부에서 같은
  // 라벨 텍스트를 넘겨 스크린리더가 각 스위치를 구분하게 한다
  ariaLabel?: string;
};

export function Toggle({ checked, onChange, disabled, label, ariaLabel }: Props) {
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
        aria-label={label ? undefined : ariaLabel}
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
