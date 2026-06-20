# Supabase 셋업 (크로스기기 동기화) — ADR 0028

크로스기기 동기화는 Supabase 프로젝트가 있어야 동작합니다. 아래는 **사용자(프로젝트 소유자)가 한 번** 하는 프로비저닝 절차입니다. 끝나면 앱 배선(다음 단계)을 진행합니다.

## 1. 프로젝트 생성
1. https://supabase.com → New project (무료 티어, 개인 1인엔 충분).
2. 리전은 가까운 곳(예: Northeast Asia / Seoul).

## 2. 스키마 적용
- 대시보드 → **SQL Editor** → [`schema.sql`](./schema.sql) 내용 붙여넣고 Run.
- 테이블 `subscriptions`, `worklog_stats` + RLS 정책 + `has_active_subscription()` 생성됨.

## 3. 구글 로그인 활성화
1. 대시보드 → **Authentication → Providers → Google** 켜기.
2. Google Cloud Console 에서 OAuth 2.0 Client ID 발급 →
   - Authorized redirect URI 에 Supabase 가 알려주는 콜백 URL 추가.
   - Client ID / Secret 을 Supabase Google provider 에 입력.
3. **Redirect URLs**(Auth → URL Configuration)에 앱 딥링크 추가: `cairn://auth-callback`

## 4. 앱에 넘길 값 (공개 가능 — 안전)
다음 두 값을 알려주세요. 앱에 내장합니다(공개돼도 무방한 값, 실제 권한은 RLS 가 강제):
- **Project URL** (예: `https://xxxx.supabase.co`)
- **anon public key** (Settings → API → Project API keys → `anon` `public`)

> ⚠️ `service_role` key 는 **절대 앱/레포에 넣지 않습니다.** 결제 웹훅(Edge Function)에서 서버 측으로만 사용.

## 5. 구독(유료 게이팅) — 후속 Phase
- `worklog_stats` 는 RLS 가 **활성 구독자만** 읽기/쓰기 허용. 구독이 없으면 동기화 자체가 막힘(클라 우회 불가).
- 결제 제공자(예: Stripe) 웹훅 → Supabase Edge Function(service_role)이 `subscriptions` 갱신. (이 Phase 는 동기화 동작 확인 후.)

## 동기화되는 데이터 (프라이버시)
- **집계 수치만**: 날짜·카테고리·PR 수·커밋 수·시간대 히스토그램. (대시보드에 이미 보이는 값)
- 코드·diff·커밋 메시지·repo 명·경로·토큰·일지 본문은 **절대 동기화 안 함**(ADR 0003/0028). 일지 본문은 노션이 이미 크로스기기로 보유.

---

다음 단계(앱 배선): 위 4번 값 받으면 — Supabase JS 클라이언트 + `cairn://` 딥링크 OAuth + worklog-stats 양방향 동기화(오프라인 우선, LWW)를 구현합니다.
