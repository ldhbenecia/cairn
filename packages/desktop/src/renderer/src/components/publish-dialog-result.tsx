import {
  Ban,
  BookOpen,
  Check,
  GitCommitHorizontal,
  GitPullRequest,
  Inbox,
  TriangleAlert,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { CoreResult, RunProgress } from '../cairn-api';
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

export function ErrorCard({
  message,
  t,
  onClose,
  onNewPublish,
}: {
  message: string;
  t: T;
  onClose: () => void;
  onNewPublish?: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 py-2">
      <p className="flex items-center gap-2 text-[15px] text-danger">
        <TriangleAlert size={18} strokeWidth={2.25} />
        {t('publish.result.error')}
      </p>
      <p className="text-[13px] leading-relaxed text-ink-muted">{message}</p>
      <div className="flex items-center gap-2">
        {onNewPublish && (
          <button
            type="button"
            onClick={onNewPublish}
            className="rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-hover"
          >
            {t('publish.newPublish')}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          {t('publish.close')}
        </button>
      </div>
    </div>
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
  onClose,
  onOpenPublished,
  onNewPublish,
}: {
  result: CoreResult;
  elapsedSec: number | null;
  modelLabel: string;
  t: T;
  onClose: () => void;
  onOpenPublished: (pageId: string, url: string | null) => void;
  onNewPublish?: () => void;
}) {
  const url = result.notionUrl ?? pageIdToUrl(result.publishPageId);
  // 노션 미연동이어도 로컬 일지가 기록됐으면 성공
  const localOnly = result.publishKind === 'no-target' && !!result.journalFile;
  const isSuccess =
    result.ok &&
    (result.publishKind !== 'no-target' || localOnly) &&
    result.publishKind !== 'skipped' &&
    !result.noActivity;
  let body: React.ReactNode;
  if (result.summaryFailed) {
    body = (
      <p className="flex items-center gap-2 text-[15px] text-danger">
        <TriangleAlert size={18} strokeWidth={2.25} />
        {t('publish.result.summaryFailed')}
      </p>
    );
  } else if (!result.ok) {
    body = (
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-danger">{t('publish.result.fail')}</p>
        <p className="text-[12.5px] leading-relaxed text-ink-tertiary">
          {result.failureHint
            ? t(`fail.${result.failureHint}`)
            : `exit ${result.exitCode ?? 'unknown'}`}
        </p>
      </div>
    );
  } else if (result.publishKind === 'no-target' && !localOnly) {
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
        {/* 노션 발행이 성공해도 로컬 journal(1차 기록) 쓰기가 실패했으면 경고 — 조용한 유실 방지 */}
        {isSuccess && result.journalWriteFailed && (
          <div className="mt-1 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.08] px-3 py-2.5">
            <TriangleAlert size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[12px] leading-relaxed text-ink-muted">
              {t('publish.result.journalWriteFailed')}
            </p>
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
        {onNewPublish && (
          <button
            type="button"
            onClick={onNewPublish}
            className="rounded-md border border-hairline px-3.5 py-2 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            {t('publish.newPublish')}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className={`rounded-md border border-hairline px-3.5 py-2 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink ${isSuccess && !onNewPublish ? '' : 'ml-auto'}`}
        >
          {t('publish.close')}
        </button>
      </div>
    </div>
  );
}
