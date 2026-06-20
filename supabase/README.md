# Supabase

크로스기기 동기화용 Postgres + Auth (ADR 0028).

- `schema.sql` — `worklog_stats` + 본인 행 RLS. SQL Editor 에 붙여 실행.
- `billing.sql` — 결제 도입 시 실행(구독 게이팅으로 정책 교체).

앱에 들어가는 공개 값: Project URL, publishable key. `service_role`·secret 은 레포·앱에 넣지 않는다.
