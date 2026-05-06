export type NotionParentType = 'database_id' | 'page_id' | 'workspace' | 'block_id';

export interface NotionPageEdit {
  id: string;
  title: string;
  url: string;
  lastEditedAt: string;
  parentType: NotionParentType;
}

export interface NotionWorkspaceActivity {
  workspace: string;
  pageCount: number;
  pages: readonly NotionPageEdit[];
  error?: string;
}

export interface NotionActivity {
  date: string;
  rangeStart: string;
  rangeEnd: string;
  workspaces: readonly NotionWorkspaceActivity[];
}
