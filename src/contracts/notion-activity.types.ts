export type NotionParentType =
  | 'database_id'
  | 'data_source_id'
  | 'page_id'
  | 'workspace'
  | 'block_id';

export interface NotionPageEdit {
  id: string;
  title: string;
  url: string;
  lastEditedAt: string;
  parentType: NotionParentType;
}

import type { CairnError } from '../common/error.js';

export interface NotionWorkspaceActivity {
  workspace: string;
  pageCount: number;
  pages: readonly NotionPageEdit[];
  error?: CairnError;
}

export interface NotionActivity {
  date: string;
  rangeStart: string;
  rangeEnd: string;
  workspaces: readonly NotionWorkspaceActivity[];
}
