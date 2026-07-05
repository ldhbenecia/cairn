import { Check, Loader2, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { NotionDb, NotionPage } from '../cairn-api';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';

export type Status = 'idle' | 'testing' | 'ok' | 'err';

type TokenKind = 'notion' | 'github';

function tokenMismatchKey(kind: TokenKind, token: string): I18nKey | null {
  const t = token.trim();
  if (!t) return null;
  const looksNotion = t.startsWith('ntn_') || t.startsWith('secret_');
  const looksGithub = ['ghp_', 'github_pat_', 'gho_'].some((p) => t.startsWith(p));
  const looksAnthropic = t.startsWith('sk-ant-');
  if (kind === 'notion' && (looksGithub || looksAnthropic))
    return looksGithub ? 'onb.token.notionWrongGithub' : 'onb.token.wrongAnthropic';
  if (kind === 'github' && (looksNotion || looksAnthropic))
    return looksNotion ? 'onb.token.githubWrongNotion' : 'onb.token.wrongAnthropic';
  return null;
}

export type NotionEntry = {
  uid: string;
  label: string;
  token: string;
  status: Status;
  error?: string;
  persons: { id: string; name: string }[];
  personId: string;
  query: string;
  pages: NotionPage[];
  pageId: string;
  searching: boolean;
  searched: boolean;
  databases: NotionDb[];
  worklogDbId: string;
  rollupDbId: string;
};

export type GithubEntry = {
  label: string;
  token: string;
  status: Status;
  error?: string;
  login?: string;
};

function StatusDot({ status }: { status: Status }) {
  if (status === 'testing')
    return <Loader2 size={14} strokeWidth={2} className="animate-spin text-accent" />;
  if (status === 'ok') return <Check size={14} strokeWidth={2.5} className="text-success" />;
  return null;
}

function LabelToken({
  kind,
  label,
  token,
  status,
  onChange,
  onTest,
  onRemove,
}: {
  kind: TokenKind;
  label: string;
  token: string;
  status: Status;
  onChange: (p: { label?: string; token?: string }) => void;
  onTest: () => void;
  onRemove?: () => void;
}) {
  const { t } = useSettings();
  const mismatchKey = tokenMismatchKey(kind, token);
  const onTestRef = useRef(onTest);
  onTestRef.current = onTest;
  const first = useRef(true);
  const manualEdit = useRef(false);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!token.trim() || mismatchKey) return;
    // gh import 는 token 과 status 'testing' 을 함께 세팅하고 스스로 probe — 그 변경만 skip.
    // probe 진행 중 사용자가 직접 타이핑한 경우는 최종 토큰 검증이 누락되지 않게 재장전 (#239 리뷰)
    if (status === 'testing' && !manualEdit.current) return;
    manualEdit.current = false;
    const id = setTimeout(() => onTestRef.current(), 800);
    return () => clearTimeout(id);
  }, [token]);

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={t('onb.field.labelPh')}
          className="w-24 rounded-md border border-hairline bg-surface-1 px-2.5 py-2 text-[13px] text-ink focus:border-accent/60 focus:outline-none"
        />
        <input
          type="password"
          value={token}
          onChange={(e) => {
            manualEdit.current = true;
            onChange({ token: e.target.value });
          }}
          placeholder={t('onb.field.tokenPh')}
          className="flex-1 rounded-md border border-hairline bg-surface-1 px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-tertiary focus:border-accent/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={onTest}
          disabled={!token.trim() || status === 'testing' || !!mismatchKey}
          className="shrink-0 rounded-md border border-hairline px-2.5 py-2 text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          {t('onb.field.test')}
        </button>
        <StatusDot status={status} />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-ink-tertiary hover:text-ink"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        )}
      </div>
      {mismatchKey && <p className="text-[12px] text-warning">{t(mismatchKey)}</p>}
    </>
  );
}

export function NotionCard({
  e,
  onChange,
  onTest,
  onSearch,
  onSelectPage,
  onRemove,
}: {
  e: NotionEntry;
  onChange: (p: Partial<NotionEntry>) => void;
  onTest: () => void;
  onSearch: () => void;
  onSelectPage: (pageId: string) => void;
  onRemove?: () => void;
}) {
  const { t } = useSettings();
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-hairline bg-surface-1 p-3">
      <LabelToken
        kind="notion"
        label={e.label}
        token={e.token}
        status={e.status}
        onChange={onChange}
        onTest={onTest}
        onRemove={onRemove}
      />
      {e.status === 'err' && <p className="text-[12px] text-danger">{e.error}</p>}
      {e.status === 'ok' && (
        <>
          {e.persons.length > 1 && (
            <select
              value={e.personId}
              onChange={(ev) => onChange({ personId: ev.target.value })}
              className="rounded-md border border-hairline bg-surface-2 px-2.5 py-2 text-[13px] text-ink"
            >
              <option value="">{t('onb.notion.selectAccount')}</option>
              {e.persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2">
            <input
              value={e.query}
              onChange={(ev) => onChange({ query: ev.target.value })}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') onSearch();
              }}
              placeholder={t('onb.notion.searchPh')}
              className="flex-1 rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-tertiary focus:border-accent/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={onSearch}
              disabled={e.searching}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            >
              {e.searching ? (
                <Loader2 size={12} strokeWidth={2} className="animate-spin" />
              ) : (
                <Search size={12} strokeWidth={2} />
              )}
              {t('onb.notion.search')}
            </button>
          </div>
          {e.pages.length > 0 && (
            <div className="max-h-44 overflow-y-auto rounded-md border border-hairline [scrollbar-gutter:stable]">
              {e.pages.map((pg) => (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() => onSelectPage(pg.id)}
                  className={[
                    'flex w-full items-center gap-2 border-b border-hairline px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-surface-2',
                    e.pageId === pg.id ? 'text-ink' : 'text-ink-muted',
                  ].join(' ')}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {e.pageId === pg.id && (
                      <Check size={13} strokeWidth={2.5} className="text-accent" />
                    )}
                  </span>
                  <span className="truncate">{pg.title}</span>
                </button>
              ))}
            </div>
          )}
          {e.searched && !e.searching && e.pages.length === 0 && (
            <p className="text-[12px] leading-relaxed text-ink-tertiary">
              {t('onb.notion.searchEmpty')}
            </p>
          )}
          {e.pageId && e.databases.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[12px] text-ink-tertiary">{t('onb.notion.dbHint')}</p>
              <div className="flex gap-2">
                <select
                  value={e.worklogDbId}
                  onChange={(ev) => onChange({ worklogDbId: ev.target.value })}
                  className="flex-1 rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink"
                >
                  <option value="">{t('onb.notion.worklogAuto')}</option>
                  {e.databases.map((d) => (
                    <option key={d.databaseId} value={d.databaseId}>
                      {t('onb.notion.worklogPrefix')}: {d.title}
                    </option>
                  ))}
                </select>
                <select
                  value={e.rollupDbId}
                  onChange={(ev) => onChange({ rollupDbId: ev.target.value })}
                  className="flex-1 rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink"
                >
                  <option value="">{t('onb.notion.rollupAuto')}</option>
                  {e.databases.map((d) => (
                    <option key={d.databaseId} value={d.databaseId}>
                      {t('onb.notion.rollupPrefix')}: {d.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function GithubCard({
  e,
  onChange,
  onTest,
  onRemove,
}: {
  e: GithubEntry;
  onChange: (p: Partial<GithubEntry>) => void;
  onTest: () => void;
  onRemove?: () => void;
}) {
  const { t } = useSettings();
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-1 p-3">
      <LabelToken
        kind="github"
        label={e.label}
        token={e.token}
        status={e.status}
        onChange={onChange}
        onTest={onTest}
        onRemove={onRemove}
      />
      {e.status === 'err' && <p className="text-[12px] text-danger">{e.error}</p>}
      {e.status === 'ok' && e.login && (
        <p className="text-[12px] text-ink-subtle">
          @{e.login} {t('onb.github.connected')}
        </p>
      )}
    </div>
  );
}
