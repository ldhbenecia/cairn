import { Check, Copy, FileText, FolderOpen, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PeriodDocResult } from '../../../shared/ipc-types';
import {
  parsePeriodDoc,
  presetRange,
  rangeProblem,
  type DocBlock,
  type PeriodPreset,
  type PeriodRange,
} from '../lib/period-doc';
import { todayLocal } from '../lib/reports';
import { useSettings } from '../settings-context';
import { DatePicker } from './date-picker';
import { useCopied } from '../use-copied';
import { useEscape } from '../use-escape';
import { OverlayDialog } from './overlay-dialog';

const PRESETS: PeriodPreset[] = ['1m', '3m', '6m', 'ytd', '1y'];
const DEFAULT_PRESET: PeriodPreset = '3m';

type View =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'doc'; content: string }
  | { kind: 'generating' }
  | { kind: 'empty' }
  | { kind: 'failed'; hint: Extract<PeriodDocResult, { status: 'fail' }>['hint'] };

export function PeriodDocDialog({ onClose }: { onClose: () => void }) {
  const { t } = useSettings();
  const today = todayLocal();
  const [preset, setPreset] = useState<PeriodPreset | null>(DEFAULT_PRESET);
  const [range, setRange] = useState<PeriodRange>(() => presetRange(DEFAULT_PRESET));
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [copied, copyText] = useCopied();
  const mounted = useRef(true);

  const problem = rangeProblem(range);
  const generating = view.kind === 'generating';
  const doc = useMemo(() => (view.kind === 'doc' ? parsePeriodDoc(view.content) : null), [view]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 자체 오버레이(Radix 아님)라 ESC 닫기를 직접 처리
  useEscape(onClose);

  useEffect(() => {
    if (problem) return;
    let alive = true;
    setView({ kind: 'loading' });
    void window.cairn.periodDoc
      .read(range)
      .then((content) => {
        if (alive) setView(content ? { kind: 'doc', content } : { kind: 'none' });
      })
      .catch(() => {
        if (alive) setView({ kind: 'none' });
      });
    return () => {
      alive = false;
    };
  }, [range, problem]);

  function pickPreset(p: PeriodPreset) {
    setPreset(p);
    setRange(presetRange(p));
  }

  function pickDate(key: keyof PeriodRange, iso: string) {
    setPreset(null);
    setRange((r) => ({ ...r, [key]: iso }));
  }

  function generate() {
    setView({ kind: 'generating' });
    void window.cairn.periodDoc
      .generate(range)
      .catch((): PeriodDocResult => ({ status: 'fail', hint: null }))
      .then((r) => {
        if (!mounted.current) return;
        if (r.status === 'ok') setView({ kind: 'doc', content: r.content });
        else if (r.status === 'empty') setView({ kind: 'empty' });
        else setView({ kind: 'failed', hint: r.hint });
      });
  }

  function copy() {
    if (!doc) return;
    copyText(doc.body);
  }

  return (
    <OverlayDialog onClose={onClose} className="flex max-h-[84vh] w-[640px] flex-col">
      <div className="flex items-start gap-3 border-b border-hairline px-6 py-4">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-[14px] font-semibold text-ink">
          <FileText size={15} strokeWidth={2} className="text-ink-tertiary" />
          {t('periodDoc.title')}
        </p>
        <button
          type="button"
          onClick={onClose}
          title={t('drawer.close')}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>

      <div className="space-y-2.5 border-b border-hairline px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-0.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={preset === p}
              disabled={generating}
              onClick={() => pickPreset(p)}
              className={[
                'rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-40',
                preset === p
                  ? 'bg-surface-3 text-ink'
                  : 'text-ink-subtle hover:bg-surface-2 hover:text-ink-muted',
              ].join(' ')}
            >
              {t(`periodDoc.preset.${p}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-tertiary">
          <DatePicker
            value={range.since}
            max={today}
            disabled={generating}
            onChange={(iso) => pickDate('since', iso)}
          />
          <span aria-hidden="true">–</span>
          <DatePicker
            value={range.until}
            max={today}
            disabled={generating}
            onChange={(iso) => pickDate('until', iso)}
          />
          {problem && (
            <span className="text-danger">
              {t(problem === 'reversed' ? 'periodDoc.reversed' : 'periodDoc.tooLong')}
            </span>
          )}
        </div>
      </div>

      <div className="min-h-[220px] flex-1 overflow-y-auto px-6 py-4">
        {problem ? null : view.kind === 'loading' ? (
          <Centered>
            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
          </Centered>
        ) : view.kind === 'generating' ? (
          <Centered>
            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            {t('periodDoc.generating')}
          </Centered>
        ) : view.kind === 'none' ? (
          <Centered column>
            <span className="text-ink-muted">{t('periodDoc.none')}</span>
            <span>{t('periodDoc.noneHint')}</span>
          </Centered>
        ) : view.kind === 'empty' ? (
          <Centered>{t('periodDoc.empty')}</Centered>
        ) : view.kind === 'failed' ? (
          <Centered>
            <span className="text-danger">
              {view.hint ? t(`fail.${view.hint}`) : t('periodDoc.failed')}
            </span>
          </Centered>
        ) : (
          doc && <DocBody blocks={doc.blocks} />
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-hairline px-6 py-3.5">
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-tertiary">
          {t('periodDoc.savedIn')}
        </span>
        {doc && (
          <>
            <button
              type="button"
              onClick={() => void window.cairn.periodDoc.reveal(range)}
              title={t('periodDoc.reveal')}
              aria-label={t('periodDoc.reveal')}
              className="flex size-8 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <FolderOpen size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={copy}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
                copied
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-hairline bg-surface-2 text-ink hover:bg-surface-3'
              }`}
            >
              {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
              {copied ? t('periodDoc.copied') : t('periodDoc.copy')}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={generate}
          disabled={generating || problem !== null || view.kind === 'loading'}
          className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white transition-[background-color,scale] hover:bg-accent-hover active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
        >
          {doc ? t('periodDoc.regenerate') : t('periodDoc.generate')}
        </button>
      </div>
    </OverlayDialog>
  );
}

function Centered({ children, column }: { children: ReactNode; column?: boolean }) {
  return (
    <div
      className={`flex h-full min-h-[188px] items-center justify-center gap-2 text-center text-[12.5px] text-ink-tertiary ${
        column ? 'flex-col' : ''
      }`}
    >
      {children}
    </div>
  );
}

// 연속된 불릿은 한 목록으로 묶음
function DocBody({ blocks }: { blocks: readonly DocBlock[] }) {
  const groups: (DocBlock | DocBlock[])[] = [];
  for (const b of blocks) {
    const last = groups[groups.length - 1];
    if (b.kind === 'item' && Array.isArray(last)) last.push(b);
    else groups.push(b.kind === 'item' ? [b] : b);
  }
  return (
    <div className="space-y-2.5">
      {groups.map((g, i) =>
        Array.isArray(g) ? (
          <ul key={i} className="space-y-1.5">
            {g.map((item, j) => (
              <li key={j} className="flex gap-2 text-[13px] leading-relaxed text-ink">
                <span
                  aria-hidden="true"
                  className="mt-[0.6em] size-1 shrink-0 rounded-full bg-ink-tertiary"
                />
                <span className="min-w-0">{item.text}</span>
              </li>
            ))}
          </ul>
        ) : g.kind === 'heading' ? (
          <h3 key={i} className="pt-2.5 text-[13px] font-semibold text-ink first:pt-0">
            {g.text}
          </h3>
        ) : (
          <p key={i} className="text-[13px] leading-relaxed text-ink-muted">
            {g.text}
          </p>
        ),
      )}
    </div>
  );
}
