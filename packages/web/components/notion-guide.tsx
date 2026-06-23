import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { VIDEO } from '../lib/assets';
import type { Lang } from '../lib/content';
import { RELEASES_LATEST } from '../lib/github';
import { BrandMark } from './brand-mark';

const GUIDE = {
  en: {
    home: '/',
    title: 'Connect Notion',
    lead: 'To publish worklogs, cairn needs a Notion integration token and a page to publish into. Takes about 30 seconds.',
    videoLabel: 'Connecting a Notion integration — 40s walkthrough',
    integrationsLink: 'Open Notion integrations',
    steps: [
      {
        t: 'Create an integration',
        d: 'At notion.so/profile/integrations, click New integration. Under Capabilities, enable Read, Update, and Insert content.',
      },
      {
        t: 'Copy the token',
        d: 'Copy the Internal Integration Secret it gives you (starts with ntn_…).',
      },
      {
        t: 'Connect it to a page',
        d: 'Create or pick the page you want worklogs published under. Open the page ⋯ menu → Connections → add the integration you just made. This is what lets cairn see the page.',
      },
      {
        t: 'Paste it into cairn',
        d: 'In the desktop app onboarding, paste the token and verify, then pick the connected page from the list. Done.',
      },
    ],
    note: 'cairn only ever sees the pages you connect the integration to — nothing else in your workspace.',
    download: 'Download the cairn desktop app',
  },
  ko: {
    home: '/ko',
    title: 'Notion 연결 가이드',
    lead: 'cairn 이 일지를 발행하려면 Notion integration 토큰과 발행할 페이지를 연결해야 합니다. 30초면 됩니다.',
    videoLabel: 'Notion integration 연결 — 40초 영상 가이드',
    integrationsLink: 'Notion integrations 열기',
    steps: [
      {
        t: 'integration 만들기',
        d: 'notion.so/profile/integrations 에서 New integration 을 누르고, 권한(Capabilities)에서 Read · Update · Insert content 를 켭니다.',
      },
      {
        t: '토큰 복사',
        d: '만들면 나오는 Internal Integration Secret(ntn_… 로 시작)을 복사합니다.',
      },
      {
        t: '페이지에 연결',
        d: '일지를 발행할 페이지를 만들거나 고르고, 페이지 ⋯ 메뉴 → 연결(Connections) → 방금 만든 integration 을 추가합니다. 이걸 해야 cairn 이 그 페이지를 볼 수 있어요.',
      },
      {
        t: 'cairn 에 입력',
        d: '데스크톱 앱 온보딩에서 토큰을 붙여넣고 확인한 뒤, 목록에서 연결한 페이지를 선택하면 끝입니다.',
      },
    ],
    note: 'cairn 은 integration 을 연결한 페이지만 볼 수 있어요 — 워크스페이스의 다른 건 안 보입니다.',
    download: 'cairn 데스크톱 앱 다운로드',
  },
} satisfies Record<Lang, unknown>;

export function NotionGuide({ lang }: { lang: Lang }) {
  const c = GUIDE[lang];
  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link
            href={c.home}
            className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-accent text-white">
              <BrandMark size={15} />
            </span>
            cairn
          </Link>
          <Link
            href={lang === 'ko' ? '/setup/notion' : '/ko/setup/notion'}
            className="rounded-lg border border-hairline-strong bg-surface-1 px-2.5 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
          >
            {lang === 'ko' ? 'English' : '한국어'}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-[28px] font-semibold tracking-[-0.025em]">{c.title}</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-subtle">{c.lead}</p>

        <div className="screenshot-frame mt-8 overflow-hidden">
          <video
            className="block w-full"
            src={VIDEO.notionIntegration}
            controls
            muted
            playsInline
            preload="metadata"
            aria-label={c.videoLabel}
          />
        </div>

        <a
          href="https://www.notion.so/profile/integrations"
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent-hover underline underline-offset-2 hover:text-accent"
        >
          <ExternalLink size={14} />
          {c.integrationsLink}
        </a>

        <ol className="mt-8 space-y-5">
          {c.steps.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-hairline-strong font-mono text-[13px] text-accent-hover">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold tracking-[-0.01em]">{s.t}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-subtle">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex items-start gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-4 text-[13.5px] leading-relaxed text-ink-subtle">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
          <p>{c.note}</p>
        </div>

        <a
          href={RELEASES_LATEST}
          className="mt-10 inline-block rounded-lg bg-accent px-5 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          {c.download}
        </a>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-3xl px-6 py-6 text-[13px] text-ink-tertiary">
          © {new Date().getFullYear()} Cairn ·{' '}
          <Link href={c.home} className="hover:text-ink">
            {lang === 'ko' ? '홈' : 'Home'}
          </Link>
        </div>
      </footer>
    </div>
  );
}
