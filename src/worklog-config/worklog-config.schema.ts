import { z } from 'zod';

export const worklogConfigSchema = z.object({
  localGitRepos: z.array(z.string().min(1)).default([]),
});

export type WorklogConfig = z.infer<typeof worklogConfigSchema>;
