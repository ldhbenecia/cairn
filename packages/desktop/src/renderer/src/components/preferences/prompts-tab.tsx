import { useEffect, useState } from 'react';
import type { SummaryModel } from '../../cairn-api';
import type { I18nKey } from '../../i18n';
import { useSettings } from '../../settings-context';

const PROMPT_MAX_CHARS = 4000;
const PROMPT_MODES = ['daily', 'weekly', 'monthly'] as const;

const MODELS: { id: SummaryModel; name: string; hint: I18nKey; desc: I18nKey }[] = [
  {
    id: 'haiku',
    name: 'Haiku',
    hint: 'prefs.prompts.model.haikuHint',
    desc: 'prefs.prompts.model.haikuDesc',
  },
  {
    id: 'sonnet',
    name: 'Sonnet',
    hint: 'prefs.prompts.model.sonnetHint',
    desc: 'prefs.prompts.model.sonnetDesc',
  },
  {
    id: 'opus',
    name: 'Opus',
    hint: 'prefs.prompts.model.opusHint',
    desc: 'prefs.prompts.model.opusDesc',
  },
  {
    id: 'default',
    name: '',
    hint: 'prefs.prompts.model.defaultHint',
    desc: 'prefs.prompts.model.defaultDesc',
  },
];

export function PromptsTab() {
  const { settings, update, t } = useSettings();
  const selectedModel = MODELS.find((m) => m.id === settings.summaryModel) ?? MODELS[1]!;
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
                className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 transition-all duration-200 ease-out active:scale-[0.96] ${
                  selected
                    ? 'border-accent/60 bg-accent/10 text-ink shadow-sm shadow-accent/15'
                    : 'border-hairline bg-surface-2 text-ink-muted hover:border-ink-tertiary hover:bg-surface-3'
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
        <div className="rounded-md border border-hairline bg-surface-1 px-3 py-2.5 text-[12px] leading-relaxed text-ink-muted">
          <span className="font-medium text-ink">
            {selectedModel.name || t('prefs.prompts.model.default')}
          </span>
          {' — '}
          {t(selectedModel.desc)}
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

// 저장은 blur 시점 (키 입력마다 settings.json 을 쓰지 않게)
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
        onKeyDown={(e) => {
          // ESC 가 다이얼로그를 바로 닫으면 blur 커밋 전에 편집 내용이 유실 — 첫 ESC 는 커밋만
          if (e.key === 'Escape') {
            e.stopPropagation();
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none rounded-md border border-hairline bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-tertiary focus:border-accent/50 focus:outline-none"
      />
    </div>
  );
}
