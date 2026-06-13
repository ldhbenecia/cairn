import { useEffect, useState } from 'react';
import type { SummaryModel } from '../../cairn-api';
import type { I18nKey } from '../../i18n';
import { useSettings } from '../../settings-context';

const PROMPT_MAX_CHARS = 4000;
const PROMPT_MODES = ['daily', 'weekly', 'monthly'] as const;

// 속도 → 품질 순. sonnet 이 기본(권장).
const MODELS: { id: SummaryModel; name: string; hint: I18nKey }[] = [
  { id: 'haiku', name: 'Haiku', hint: 'prefs.prompts.model.haikuHint' },
  { id: 'sonnet', name: 'Sonnet', hint: 'prefs.prompts.model.sonnetHint' },
  { id: 'opus', name: 'Opus', hint: 'prefs.prompts.model.opusHint' },
  { id: 'default', name: '', hint: 'prefs.prompts.model.defaultHint' },
];

export function PromptsTab() {
  const { settings, update, t } = useSettings();
  const labelKey: Record<(typeof PROMPT_MODES)[number], { label: I18nKey; ph: I18nKey }> = {
    daily: { label: 'prefs.prompts.daily', ph: 'prefs.prompts.daily.ph' },
    weekly: { label: 'prefs.prompts.weekly', ph: 'prefs.prompts.weekly.ph' },
    monthly: { label: 'prefs.prompts.monthly', ph: 'prefs.prompts.monthly.ph' },
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium text-ink">{t('prefs.prompts.model')}</p>
        <p className="text-[12px] leading-relaxed text-ink-tertiary">
          {t('prefs.prompts.modelDesc')}
        </p>
        <div className="mt-1 grid grid-cols-4 gap-1.5">
          {MODELS.map((m) => {
            const selected = settings.summaryModel === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => update({ summaryModel: m.id })}
                className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 transition-colors ${
                  selected
                    ? 'border-accent/60 bg-accent/10 text-ink'
                    : 'border-hairline bg-surface-2 text-ink-secondary hover:border-ink-tertiary'
                }`}
              >
                <span className="text-[13px] font-medium">
                  {m.name || t('prefs.prompts.model.default')}
                </span>
                <span className="text-[11px] text-ink-tertiary">{t(m.hint)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-hairline" />

      <div className="flex flex-col gap-5">
        <p className="text-[12px] leading-relaxed text-ink-tertiary">{t('prefs.prompts.desc')}</p>
        {PROMPT_MODES.map((mode) => (
          <PromptField
            key={mode}
            label={t(labelKey[mode].label)}
            placeholder={t(labelKey[mode].ph)}
            value={settings.prompts[mode]}
            onSave={(v) => update({ prompts: { ...settings.prompts, [mode]: v } })}
          />
        ))}
      </div>
    </div>
  );
}

// 저장은 blur 시점 — 키 입력마다 settings.json 을 다시 쓰지 않기 위해
function PromptField({
  label,
  placeholder,
  value,
  onSave,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  onSave: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-medium text-ink">{label}</p>
      <textarea
        value={draft}
        maxLength={PROMPT_MAX_CHARS}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onSave(draft.trim().length > 0 ? draft : null)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none rounded-md border border-hairline bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-tertiary focus:border-accent/50 focus:outline-none"
      />
    </div>
  );
}
