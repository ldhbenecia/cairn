# 0028. 크로스기기 동기화 — Supabase + 구글 로그인 (서버리스)

- 상태: accepted
- 작성일: 2026-06-20
- 관련: 플랜 [docs/plans/2026-06-19-monetization-and-sync.md], ADR 0002(머신 분리)·0003(egress)·0027(통계 로컬 진실 소스)

## 맥락

통계 진실 소스가 로컬 `~/.cairn/worklog-stats.json`(ADR 0027)이라 **다른 기기에 설치하면 대시보드가 빈다.** 또한 수익 모델이 필요한데, cairn 은 **public 레포 + 로컬 실행 + 사용자 본인 토큰**이라 로컬에서 완결되는 기능은 결제로 못 막는다(게이팅 코드가 우회됨). 막을 수 있는 건 **우리가 운영하는 서버 측 자원**뿐이다.

## 결정

**구글 로그인 + Supabase(Postgres + Auth + Edge Functions) + 결제**로 크로스기기 동기화를 제공한다. **자체 서버는 띄우지 않는다**(앱 ↔ Supabase 직접, anon key + RLS).

### 동기화 대상 (egress 화이트리스트 — ADR 0003 확장)
- 동기화하는 건 **집계 수치뿐**: `worklog_stats(category, date, pr, commit, hours[24])`.
- **절대 동기화 금지**: 코드 본문·diff·커밋 메시지·repo 명·절대경로·노션/깃허브/Claude 토큰·일지 본문. (일지 본문은 이미 노션이 크로스기기로 들고 있음 — 중복 동기화 안 함.)
- 업로드 페이로드도 fail-closed 검사(`assertNoForbiddenPayload`)를 통과해야 한다. 스키마에 민감 필드를 아예 두지 않는다.

### 유료 게이팅은 RLS(서버 측)로 강제 — public 레포 핵심
- 클라이언트 구독 체크는 우회 가능하므로, **`worklog_stats` 의 RLS 정책이 "활성 구독" 여부를 서버에서 검사**한다. 비결제자는 인증돼 있어도 행을 읽거나 쓸 수 없다.
- 자가 호스팅(본인 Supabase 직접 구성)은 가능하지만 대부분 편의에 과금하는 합법적 open-core/호스팅 모델.

### Auth (Electron)
- Supabase Auth + Google OAuth. 시스템 브라우저로 OAuth → custom protocol `cairn://auth-callback` 으로 토큰 콜백 수신 → 세션은 **keychain** 저장(기존 토큰과 동일).

### 동기화 정책 (오프라인 우선)
- 로컬 `worklog-stats.json` 이 1차 진실 소스. 발행 시 로컬 기록 후 best-effort upsert.
- 로그인/앱 시작 시 원격 pull → 로컬과 머지, **`updated_at` 최신 승**(last-write-wins). 새 기기 = 원격 전체 pull.
- 무료 사용자는 로그인 없이 **100% 로컬**로 동작(로그인 강제 금지).

### 결제 (후속 Phase)
- 결제 제공자(예: Stripe Checkout) → 웹훅을 Supabase Edge Function 으로 받아 `subscriptions` 갱신. 앱은 구독 상태를 읽어 동기화 토글.

## 대안
- **자체 백엔드 서버**: 운영 부담 → 기각(서버리스 선택).
- **클라이언트 구독 체크만**: public 레포라 우회됨 → 기각(RLS 서버 강제 채택).
- **노션에 통계 보관**(되돌리기): 사용자가 노션에서 지우거나 조작 가능 → ADR 0027 에서 이미 기각.

## 결과
- 단일 머신 가정(ADR 0002)을 넘어 로그인 시 멀티 기기 동기화. 무료는 로컬 유지.
- 민감도 낮음: 동기화 데이터는 대시보드에 이미 보이는 집계 수치뿐(코드/경로/토큰 없음).
- 외부 의존: Supabase 무료 티어(개인 1인엔 충분), 결제 제공자. 앱에 Supabase URL + anon key(공개 가능) 필요.
- 후속: 구독 RLS·결제 웹훅·새 기기 머지 충돌(현재 LWW) 정교화.
