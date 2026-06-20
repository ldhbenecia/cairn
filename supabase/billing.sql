-- 유료 게이팅 (ADR 0028). schema.sql 적용 후, 결제 도입 시 실행.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "own subscription read" on public.subscriptions;
create policy "own subscription read" on public.subscriptions
  for select using (auth.uid() = user_id);

create or replace function public.has_active_subscription(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

drop policy if exists "own stats rw" on public.worklog_stats;
create policy "subscriber rw own stats" on public.worklog_stats
  for all
  using (auth.uid() = user_id and public.has_active_subscription(auth.uid()))
  with check (auth.uid() = user_id and public.has_active_subscription(auth.uid()));
