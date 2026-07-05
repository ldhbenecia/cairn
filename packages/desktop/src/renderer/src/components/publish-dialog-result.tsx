import {
  Ban,
  BookOpen,
  BotOff,
  Check,
  GitCommitHorizontal,
  GitPullRequest,
  Hourglass,
  Inbox,
  type LucideIcon,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import type { CoreResult, RunProgress } from '../cairn-api';
import { AccordionItem } from './accordion';
import type { T } from './publish-dialog-utils';

function pageIdToUrl(pageId: string | null): string | null {
  if (!pageId || pageId.startsWith('journal:')) return null;
  return `https://www.notion.so/${pageId.replace(/-/g, '')}`;
}

export function CancelledCard({
  progress,
  t,
  onClose,
}: {
  progress?: RunProgress;
  t: T;
  onClose: () => void;
}) {
  const partial = progress && progress.total > 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-4 py-6 text-center"
    >
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.05 }}
        className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-tertiary"
      >
        <Ban size={22} strokeWidth={2} />
      </motion.span>
      <div className="flex flex-col gap-1.5">
        <p className="text-[14px] font-medium text-ink">{t('publish.result.cancelled')}</p>
        {partial && (
          <p className="font-mono text-[12px] text-ink-tertiary tabular-nums">
            {progress.done} / {progress.total}
            {t('publish.backfill.daysSuffix')} {t('publish.cancelled.partial')}
          </p>
        )}
        <p className="mx-auto max-w-[330px] text-[12px] leading-relaxed text-balance text-ink-muted">
          {t('publish.cancelled.desc')}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-1 rounded-md border border-hairline px-3.5 py-2 text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        {t('publish.close')}
      </button>
    </motion.div>
  );
}

function ErrorHero({
  icon: Icon,
  tone = 'danger',
  title,
  desc,
  detail,
  t,
  onRetry,
  onClose,
}: {
  icon: LucideIcon;
  tone?: 'danger' | 'muted';
  title: string;
  desc: string;
  detail?: string;
  t: T;
  onRetry?: () => void;
  onClose: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4 py-4"
    >
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.05 }}
          className={`flex size-12 items-center justify-center rounded-full ${
            tone === 'danger' ? 'bg-danger/12 text-danger' : 'bg-surface-2 text-ink-tertiary'
          }`}
        >
          <Icon size={22} strokeWidth={2} />
        </motion.span>
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        <p className="mx-auto max-w-[330px] text-[12px] leading-relaxed text-balance text-ink-muted">
          {desc}
        </p>
      </div>
      {detail && (
        <AccordionItem
          open={detailOpen}
          onToggle={() => setDetailOpen((v) => !v)}
          header={
            <span className="text-[12px] text-ink-tertiary">{t('publish.error.details')}</span>
          }
          aria-label={t('publish.error.details')}
        >
          <pre className="mt-1 max-h-36 overflow-auto rounded-md bg-surface-2/60 px-3 py-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-tertiary">
            {detail}
          </pre>
        </AccordionItem>
      )}
      <div className="flex items-center justify-center gap-2.5 pt-1">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-hover"
          >
            <RotateCcw size={14} strokeWidth={2} />
            {t('publish.retry')}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-hairline px-3.5 py-2 text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {t('publish.close')}
        </button>
      </div>
    </motion.div>
  );
}

export function ErrorCard({
  message,
  t,
  onRetry,
  onClose,
}: {
  message: string;
  t: T;
  onRetry: () => void;
  onClose: () => void;
}) {
  // App.trigger 가 busy 일 때 error 로 busyMsg 를 넣음 — 이 경우만 중립 톤(재시도 버튼 X)
  const isBusy = message === t('publish.busyMsg');
  if (isBusy) {
    return (
      <ErrorHero
        icon={Hourglass}
        tone="muted"
        title={t('publish.busy')}
        desc={message}
        t={t}
        onClose={onClose}
      />
    );
  }
  return (
    <ErrorHero
      icon={TriangleAlert}
      title={t('publish.result.error')}
      desc={message}
      t={t}
      onRetry={onRetry}
      onClose={onClose}
    />
  );
}

function fmtElapsed(sec: number): string {
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function Result({
  result,
  elapsedSec,
  modelLabel,
  t,
  onRetry,
  onClose,
  onOpenPublished,
}: {
  result: CoreResult;
  elapsedSec: number | null;
  modelLabel: string;
  t: T;
  onRetry: () => void;
  onClose: () => void;
  onOpenPublished: (pageId: string, url: string | null) => void;
}) {
  const url = result.notionUrl ?? pageIdToUrl(result.publishPageId);
  // 노션 미연동이어도 로컬 일지가 기록됐으면 성공
  const localOnly = result.publishKind === 'no-target' && !!result.journalFile;
  const isSuccess =
    result.ok &&
    (result.publishKind !== 'no-target' || localOnly) &&
    result.publishKind !== 'skipped' &&
    !result.noActivity;
  if (result.summaryFailed) {
    return (
      <ErrorHero
        icon={BotOff}
        title={t('publish.error.summaryTitle')}
        desc={t('publish.error.summaryDesc')}
        detail={result.stderrTail.trim() || undefined}
        t={t}
        onRetry={onRetry}
        onClose={onClose}
      />
    );
  }
  if (!result.ok) {
    const detail = [`exit ${result.exitCode ?? 'unknown'}`, result.stderrTail.trim()]
      .filter(Boolean)
      .join('\n');
    return (
      <ErrorHero
        icon={TriangleAlert}
        title={t('publish.error.failTitle')}
        desc={t('publish.error.failDesc')}
        detail={detail}
        t={t}
        onRetry={onRetry}
        onClose={onClose}
      />
    );
  }
  let body: React.ReactNode;
  if (result.publishKind === 'no-target' && !localOnly) {
    body = <p className="text-notice">{t('publish.result.noTarget')}</p>;
  } else if (result.noActivity) {
    body = (
      <div className="flex flex-col items-center gap-2 pt-3 pb-1 text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.05 }}
          className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-tertiary"
        >
          <Inbox size={22} strokeWidth={2} />
        </motion.span>
        <p className="text-[15px] font-semibold text-ink">{t('publish.result.noActivity')}</p>
        <p className="mx-auto max-w-[320px] text-[12px] leading-relaxed text-ink-muted">
          {t('publish.result.noActivityDesc')}
        </p>
      </div>
    );
  } else if (result.publishKind === 'skipped') {
    body = <p className="text-ink-muted">{t('publish.result.skipped')}</p>;
  } else {
    body = (
      <div className="flex flex-col items-center gap-2 pt-3 pb-1 text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.05 }}
          className="flex size-12 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-400"
        >
          <Check size={22} strokeWidth={2.5} />
        </motion.span>
        <p className="text-[15px] font-semibold text-ink">
          {t(localOnly ? 'publish.result.doneLocal' : 'publish.result.done')}
        </p>
        {(modelLabel || elapsedSec !== null) && (
          <p className="text-[12px] text-ink-tertiary">
            {[modelLabel, elapsedSec !== null ? fmtElapsed(elapsedSec) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="flex flex-col gap-2">
        {body}
        {isSuccess && (result.prCount > 0 || result.commitCount > 0) && (
          <div className="mt-1 grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface-1 px-3.5 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/12 text-sky-400">
                <GitPullRequest size={15} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[17px] leading-tight font-semibold text-ink tabular-nums">
                  {result.prCount}
                </p>
                <p className="text-[11px] text-ink-tertiary">PR</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface-1 px-3.5 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-400">
                <GitCommitHorizontal size={15} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[17px] leading-tight font-semibold text-ink tabular-nums">
                  {result.commitCount}
                </p>
                <p className="text-[11px] text-ink-tertiary">{t('publish.collected.commits')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      <div
        className={
          isSuccess ? 'flex items-center justify-center gap-2.5' : 'flex items-center gap-3'
        }
      >
        {result.publishPageId && (
          <button
            type="button"
            onClick={() => {
              onOpenPublished(result.publishPageId!, url);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-hover"
          >
            <BookOpen size={14} strokeWidth={2} />
            {t('publish.viewInApp')}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className={`rounded-md border border-hairline px-3.5 py-2 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink ${isSuccess ? '' : 'ml-auto'}`}
        >
          {t('publish.close')}
        </button>
      </div>
    </div>
  );
}
