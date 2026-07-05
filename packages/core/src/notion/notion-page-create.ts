import type { Client } from '@notionhq/client';

// Notion pages.create 는 children 을 한 번에 100개까지만 받는다.
// 초과분은 blocks.children.append 로 ≤100 배치 분할해 붙인다.
export const NOTION_MAX_CHILDREN = 100;

export async function appendChildrenInBatches(
  client: Client,
  pageId: string,
  blocks: readonly unknown[],
): Promise<void> {
  for (let i = 0; i < blocks.length; i += NOTION_MAX_CHILDREN) {
    await client.blocks.children.append({
      block_id: pageId,
      children: blocks.slice(i, i + NOTION_MAX_CHILDREN) as never,
    });
  }
}
