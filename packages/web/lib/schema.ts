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
    date: date('date').notNull(),
    pr: integer('pr').notNull().default(0),
    commitCount: integer('commit_count').notNull().default(0),
    hours: integer('hours').array().notNull().default([]),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.category, t.date] })],
);
