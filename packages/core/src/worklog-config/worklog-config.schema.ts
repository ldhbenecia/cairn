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

export const githubAccountConfigSchema = z.object({
  label: z.string().min(1),
  tokenEnv: z.string().min(1),
});

export const journalConfigSchema = z.object({
  folder: z.string().min(1),
});

export const worklogConfigSchema = z.object({
  // 기본 OFF — 등록된 localGitRepos 경로는 보존하되 수집은 이 토글로만 켠다
  localGitEnabled: z.boolean().default(false),
  localGitRepos: z.array(z.string().min(1)).default([]),
  notionWorkspaces: z.array(notionWorkspaceConfigSchema).default([]),
  githubAccounts: z.array(githubAccountConfigSchema).default([]),
  journal: journalConfigSchema.optional(),
});

export type NotionWorkspaceConfig = z.infer<typeof notionWorkspaceConfigSchema>;
export type GithubAccountConfig = z.infer<typeof githubAccountConfigSchema>;
export type WorklogConfig = z.infer<typeof worklogConfigSchema>;
