import { ExternalLink, Github, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSettings } from '../../settings-context';
import type { I18nKey } from '../../i18n';
import { Accordion, AccordionItem } from '../accordion';
import { Toggle } from '../toggle';
import { REPO_URL } from './constants';
import { Field } from './field';

const FAQ_COUNT = 6;

export function AboutTab() {
  const { settings, update, t } = useSettings();
  const [stars, setStars] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void window.cairn.repoStars?.().then((n) => {
      if (alive) setStars(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        aria-label={t('prefs.about.repo')}
        onClick={() => void window.cairn.openExternal(REPO_URL)}
        className="group flex items-center gap-3.5 rounded-xl border border-hairline bg-surface-2 px-4 py-4 text-left transition-colors hover:border-ink/15 hover:bg-surface-2/70"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-1 text-ink">
          <Github size={22} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            ldhbenecia/cairn
            <ExternalLink
              size={12}
              strokeWidth={2}
              className="text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100"
            />
          </div>
          <div className="mt-0.5 text-[12px] text-ink-tertiary">{t('prefs.about.repo.desc')}</div>
        </div>
        {stars !== null && (
          <span className="group/star flex shrink-0 items-center gap-1 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-subtle transition-colors hover:border-yellow-400/40">
            <Star
              size={12}
              strokeWidth={2}
              className="fill-current transition-colors group-hover/star:text-yellow-400"
            />
            {stars}
          </span>
        )}
      </button>

      <div className="py-1">
        <p className="mb-3 text-[13px] font-medium text-ink">{t('faq.title')}</p>
        <Accordion>
          {Array.from({ length: FAQ_COUNT }, (_, i) => (
            <AccordionItem
              key={i}
              icon="plus"
              open={openFaq === i}
              onToggle={() => setOpenFaq((cur) => (cur === i ? null : i))}
              triggerClassName="px-2 py-3.5"
              header={<span className="text-ink-muted">{t(`faq.q${i + 1}` as I18nKey)}</span>}
            >
              <p className="max-w-[560px] px-2 pt-0.5 pb-4 text-[12.5px] leading-relaxed text-ink-tertiary">
                {t(`faq.a${i + 1}` as I18nKey)}
              </p>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="divide-y divide-hairline">
        <Field label={t('prefs.telemetry')} desc={t('prefs.telemetry.desc')}>
          <Toggle checked={settings.telemetry} onChange={(v) => update({ telemetry: v })} />
        </Field>
      </div>
      <p className="text-[12px] leading-relaxed text-ink-tertiary">{t('prefs.privacy')}</p>
    </div>
  );
}
