-- cairn 크로스기기 동기화 스키마 (ADR 0028)
-- Supabase 대시보드 → SQL Editor 에 붙여넣어 1회 실행.
-- 핵심: 유료 게이팅을 RLS(서버 측)로 강제 — public 레포라 클라 체크는 우회되므로,
-- worklog_stats 접근 자체를 "활성 구독" 조건으로 막는다.

-- ── 구독: 결제 웹훅(Edge Function = service_role)만 쓰기. 사용자는 본인 것 읽기만 ──
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free',
  status text not null default 'inactive', -- 'active' | 'inactive' | 'canceled'
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "own subscription read" on public.subscriptions;
create policy "own subscription read" on public.subscriptions
  for select using (auth.uid() = user_id);
-- INSERT/UPDATE 정책 없음 → service_role(결제 웹훅)만 가능. 사용자 자가발급 차단.

-- 활성 구독 여부 (RLS 게이팅용). security definer 로 RLS 컨텍스트에서 subscriptions 조회.
create or replace function public.has_active_subscription(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- ── 통계: 본인 + 활성 구독자만. 집계 수치만 저장(코드/경로/토큰 절대 금지 — ADR 0003/0028) ──
create table if not exists public.worklog_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null, -- 'daily' | 'weekly' | 'monthly'
  date date not null,
  pr int not null default 0,
  commit_count int not null default 0, -- 'commit' 는 SQL 키워드라 commit_count (앱에서 매핑)
  hours int[] not null default '{}', -- 24칸 시간 히스토그램 (daily 만)
  updated_at timestamptz not null default now(),
  primary key (user_id, category, date)
);

alter table public.worklog_stats enable row level security;

drop policy if exists "subscriber rw own stats" on public.worklog_stats;
create policy "subscriber rw own stats" on public.worklog_stats
  for all
  using (auth.uid() = user_id and public.has_active_subscription(auth.uid()))
  with check (auth.uid() = user_id and public.has_active_subscription(auth.uid()));
