import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CodexModel, SummaryModel, SummaryProvider } from '../../../../shared/ipc-types';
import type { I18nKey } from '../../i18n';
import { PROVIDER_NAME } from '../../lib/summary-provider';
import { useSettings } from '../../settings-context';
import { Section } from './field';

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

const PROVIDERS: { id: SummaryProvider; desc: I18nKey }[] = [
  { id: 'claude', desc: 'prefs.prompts.provider.claudeDesc' },
  { id: 'codex', desc: 'prefs.prompts.provider.codexDesc' },
];

export function PromptsTab() {
  const { settings, update, t } = useSettings();
  const selectedModel = MODELS.find((m) => m.id === settings.summaryModel) ?? MODELS[1]!;
  const labelKey: Record<(typeof PROMPT_MODES)[number], { label: I18nKey; ph: I18nKey }> = {
    daily: { label: 'prefs.prompts.daily', ph: 'prefs.prompts.daily.ph' },
    weekly: { label: 'prefs.prompts.weekly', ph: 'prefs.prompts.weekly.ph' },
    monthly: { label: 'prefs.prompts.monthly', ph: 'prefs.prompts.monthly.ph' },
  };

  const provider = settings.summaryProvider;
  const [codexModels, setCodexModels] = useState<CodexModel[]>([]);
  useEffect(() => {
    if (provider !== 'codex') return;
    let alive = true;
    void window.cairn.connections
      .codexModels()
      .then((m) => alive && setCodexModels(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [provider]);

  return (
    <div className="flex flex-col gap-9">
      <Section label={t('prefs.prompts.provider')}>
        <div className="pt-3">
          <p className="text-[12px] leading-relaxed text-ink-tertiary">
            {t('prefs.prompts.providerDesc')}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {PROVIDERS.map((p) => (
              <OptionButton
                key={p.id}
                selected={provider === p.id}
                onClick={() => update({ summaryProvider: p.id })}
                name={PROVIDER_NAME[p.id]}
              />
            ))}
          </div>
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-tertiary">
            <span className="font-medium text-ink-muted">{PROVIDER_NAME[provider]}</span>
            {' — '}
            {t(PROVIDERS.find((p) => p.id === provider)!.desc)}
          </p>
        </div>
      </Section>

      {provider === 'codex' && (
        <Section label={t('prefs.prompts.codexModel')}>
          <div className="pt-3">
            <p className="text-[12px] leading-relaxed text-ink-tertiary">
              {t('prefs.prompts.codexModelDesc')}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <OptionButton
                selected={settings.codexModel === null}
                onClick={() => update({ codexModel: null })}
                name={t('prefs.prompts.model.default')}
              />
              {codexModels.map((m) => (
                <OptionButton
                  key={m.slug}
                  selected={settings.codexModel === m.slug}
                  onClick={() => update({ codexModel: m.slug })}
                  name={m.name}
                />
              ))}
            </div>
          </div>
        </Section>
      )}

      {provider === 'claude' && (
        <Section label={t('prefs.prompts.model')}>
          <div className="pt-3">
            <p className="text-[12px] leading-relaxed text-ink-tertiary">
              {t('prefs.prompts.modelDesc')}
            </p>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {MODELS.map((m) => (
                <OptionButton
                  key={m.id}
                  selected={settings.summaryModel === m.id}
                  onClick={() => update({ summaryModel: m.id })}
                  name={m.name || t('prefs.prompts.model.default')}
                  hint={t(m.hint)}
                />
              ))}
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-ink-tertiary">
              <span className="font-medium text-ink-muted">
                {selectedModel.name || t('prefs.prompts.model.default')}
              </span>
              {' — '}
              {t(selectedModel.desc)}
            </p>
          </div>
        </Section>
      )}

      <Section label={t('prefs.prompts.custom')}>
        <div className="flex flex-col gap-5 pt-3">
          <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface-2 px-3 py-2 text-[12px] text-ink-muted">
            <Lock size={13} strokeWidth={2} className="shrink-0 text-ink-tertiary" />
            {t('prefs.prompts.proLock')}
          </div>
          <p className="text-[12px] leading-relaxed text-ink-tertiary">{t('prefs.prompts.desc')}</p>
          {PROMPT_MODES.map((mode) => (
            <PromptField
              key={mode}
              label={t(labelKey[mode].label)}
              placeholder={t(labelKey[mode].ph)}
              value={settings.prompts[mode]}
              disabled
              onSave={(v) => update({ prompts: { ...settings.prompts, [mode]: v } })}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

// 저장은 blur 시점 — 키 입력마다 settings.json 을 쓰지 않게
function PromptField({
  label,
  placeholder,
  value,
  disabled,
  onSave,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  disabled?: boolean;
  onSave: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  return (
    <div className={['flex flex-col gap-1.5', disabled ? 'opacity-50' : ''].join(' ')}>
      <p className="text-[13px] font-medium text-ink">{label}</p>
      <textarea
        value={draft}
        maxLength={PROMPT_MAX_CHARS}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onSave(draft.trim().length > 0 ? draft : null)}
        onKeyDown={(e) => {
          // ESC 가 다이얼로그를 바로 닫으면 blur 커밋 전에 편집 내용 유실 — 첫 ESC 는 커밋만
          if (e.key === 'Escape') {
            e.stopPropagation();
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none rounded-md border border-hairline bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-tertiary focus:border-accent/50 focus:outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}

function OptionButton({
  selected,
  onClick,
  name,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  name: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 transition-[border-color,background-color,color,scale] duration-200 ease-out active:scale-[0.96] ${
        selected
          ? 'border-hairline-strong bg-surface-3 text-ink'
          : 'border-hairline bg-surface-2 text-ink-muted hover:border-ink-tertiary hover:bg-surface-3'
      }`}
    >
      <span className="text-[13px] font-medium">{name}</span>
      {hint && <span className="text-[11px] text-ink-tertiary">{hint}</span>}
    </button>
  );
}
