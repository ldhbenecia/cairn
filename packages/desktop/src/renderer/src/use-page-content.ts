import { useCallback, useEffect, useState } from 'react';
import type { PageContent, RecentPage } from './cairn-api';
import { useSettings } from './settings-context';

// 일지 본문 로드 — 조회 실패 시 무한 로딩 대신 warning 경로로 오류 문구 표시
export function usePageContent(page: RecentPage): {
  content: PageContent | null;
  reload: () => void;
} {
  const { t } = useSettings();
  const [content, setContent] = useState<PageContent | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setContent(null);
    void window.cairn.pageContent(page.pageId, page.workspaceLabel).then(
      (c) => {
        if (alive) setContent(c);
      },
      () => {
        if (alive) setContent({ blocks: [], warning: t('drawer.loadError') });
      },
    );
    return () => {
      alive = false;
    };
  }, [page.pageId, page.workspaceLabel, reloadTick, t]);

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);
  return { content, reload };
}
