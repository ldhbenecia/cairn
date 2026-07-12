import type { RecentPage, SimpleBlock } from '../cairn-api';
import { sectionBullets } from './blocks';

export type StandupLabels = {
  yesterday: string;
  today: string;
  blockers: string;
  none: string;
};

export function pickStandupSource(
  pages: readonly RecentPage[],
  todayIso: string,
): RecentPage | null {
  const dailies = pages
    .filter((p) => p.category === 'daily' && p.date != null && p.date <= todayIso)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return dailies.find((p) => (p.date ?? '') < todayIso) ?? dailies[0] ?? null;
}

// Share(프롬프트가 스탠드업용으로 뽑는 한 줄들)가 1순위, 없으면 Done
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
