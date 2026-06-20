-- worklog_stats 동기화 (ADR 0028). 결제 게이팅은 billing.sql.
create table if not exists public.worklog_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  date date not null,
  pr int not null default 0,
  commit_count int not null default 0,
  hours int[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, category, date)
);

alter table public.worklog_stats enable row level security;

drop policy if exists "own stats rw" on public.worklog_stats;
create policy "own stats rw" on public.worklog_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
