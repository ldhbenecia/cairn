import type { RecentPage, SimpleBlock } from '../cairn-api';
import { sectionBullets } from './blocks';

export type StandupLabels = {
  yesterday: string;
  today: string;
  blockers: string;
  none: string;
};

// 스탠드업 소스 일지 선택 — 오늘 이전의 최신 daily 우선, 없으면 오늘(이미 발행한 경우)
export function pickStandupSource(
  pages: readonly RecentPage[],
  todayIso: string,
): RecentPage | null {
  const dailies = pages
    .filter((p) => p.category === 'daily' && p.date != null && p.date <= todayIso)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return dailies.find((p) => (p.date ?? '') < todayIso) ?? dailies[0] ?? null;
}

// Share(스탠드업용으로 요약된 한 줄들)가 1순위, 없으면 Done. 오늘 예정은 In Progress 에서
export function buildStandupText(
  blocks: SimpleBlock[],
  sourceDate: string,
  labels: StandupLabels,
): string {
  const share = sectionBullets(blocks, 'share');
  const yesterday = share.length > 0 ? share : sectionBullets(blocks, 'done');
  const today = sectionBullets(blocks, 'in progress');
  const bullets = (lines: string[]): string =>
    (lines.length > 0 ? lines : [labels.none]).map((l) => `- ${l}`).join('\n');
  return [
    `${labels.yesterday} (${sourceDate})`,
    bullets(yesterday),
    '',
    labels.today,
    bullets(today),
    '',
    labels.blockers,
    `- ${labels.none}`,
  ].join('\n');
}
