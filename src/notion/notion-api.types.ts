export type NotionParentTypeRaw =
  | 'database_id'
  | 'data_source_id'
  | 'page_id'
  | 'workspace'
  | 'block_id';

export interface RawNotionPage {
  id: string;
  url: string;
  lastEditedTime: string;
  lastEditedById: string;
  parentType: NotionParentTypeRaw;
  parentId: string | null;
  title: string;
}

export interface SearchPagesResult {
  pages: RawNotionPage[];
  nextCursor: string | null;
}

export interface CreateWorklogDatabaseInput {
  token: string;
  parentPageId: string;
  title: string;
}

export interface CreateWorklogDatabaseResult {
  databaseId: string;
  dataSourceId: string;
}

export interface CreateWorklogPageInput {
  token: string;
  dataSourceId: string;
  date: string;
  title: string;
  sourceCounts: string;
  tags?: readonly string[];
  children?: readonly unknown[];
}

export interface ExistingWorklogPage {
  pageId: string;
  status: string | null;
}

export interface WorklogPageInRange {
  pageId: string;
  url: string | null;
  date: string;
  sourceCounts: string;
}

export type ExtractedBlock =
  | { type: 'heading_2'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bulleted_list_item'; text: string }
  | { type: 'other' };

export interface CreateRollupDatabaseInput {
  token: string;
  parentPageId: string;
  title: string;
}

export interface CreateRollupDatabaseResult {
  databaseId: string;
  dataSourceId: string;
}

export interface CreateRollupPageInput {
  token: string;
  dataSourceId: string;
  period: 'weekly' | 'monthly';
  rangeStart: string;
  rangeEnd: string;
  title: string;
  tags?: readonly string[];
  children?: readonly unknown[];
}

export interface ExistingRollupPage {
  pageId: string;
  status: string | null;
}
