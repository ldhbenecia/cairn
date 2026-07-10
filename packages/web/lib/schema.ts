import { date, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

import { user } from './auth-schema';

export * from './auth-schema';

export const worklogStats = pgTable(
  'worklog_stats',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    // mode 'string' — 드라이버가 DATE 를 JS Date(서버 로컬 자정)로 파싱해 JSON 직렬화 시
    // UTC 변환으로 하루 밀리던 문제. 'YYYY-MM-DD' 문자열로 왕복 (타임존 룰)
    date: date('date', { mode: 'string' }).notNull(),
    pr: integer('pr').notNull().default(0),
    commitCount: integer('commit_count').notNull().default(0),
    hours: integer('hours').array().notNull().default([]),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.category, t.date] })],
);
