import { z } from 'zod';

export const worklogTargetSchema = z.object({
  pageId: z.uuid().optional(),
  databaseId: z.uuid().optional(),
  dataSourceId: z.uuid().optional(),
});

export const notionWorkspaceConfigSchema = z.object({
  label: z.string().min(1),
  tokenEnv: z.string().min(1),
  myUserId: z.uuid(),
  worklog: worklogTargetSchema.optional(),
  rollup: worklogTargetSchema.optional(),
});

export const worklogConfigSchema = z.object({
  localGitRepos: z.array(z.string().min(1)).default([]),
  notionWorkspaces: z.array(notionWorkspaceConfigSchema).default([]),
});

export type NotionWorkspaceConfig = z.infer<typeof notionWorkspaceConfigSchema>;
export type WorklogConfig = z.infer<typeof worklogConfigSchema>;
