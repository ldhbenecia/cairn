import { z } from 'zod';

export const notionWorkspaceConfigSchema = z.object({
  label: z.string().min(1),
  tokenEnv: z.string().min(1),
  myUserId: z.uuid(),
});

export const worklogConfigSchema = z.object({
  localGitRepos: z.array(z.string().min(1)).default([]),
  notionWorkspaces: z.array(notionWorkspaceConfigSchema).default([]),
});

export type NotionWorkspaceConfig = z.infer<typeof notionWorkspaceConfigSchema>;
export type WorklogConfig = z.infer<typeof worklogConfigSchema>;
