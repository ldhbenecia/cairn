# 2026-06-19 — 수익화 + 크로스기기 동기화 플랜

> 상태: proposed (미착수, 로드맵). 착수 시점에 단계별로 쪼개 PR.

지금 cairn 은 **단일 머신 로컬 전용**(ADR 0002)이다. 통계 진실 소스도 로컬 파일
`~/.cairn/worklog-stats.json`(ADR 0027). 이 구조에서 두 가지 한계가 드러났다:

1. **다른 노트북에 설치하면 통계가 비어 있다.** 로컬 파일이 없으니 대시보드가 0. 노션엔
   일지 본문이 남아 있어도 통계(PR·커밋·시간대)는 로컬에만 있어 옮겨지지 않는다.
2. **지정 날짜 범위 발행**(임의 시작~종료 백필)은 비용이 큰 기능이라 무료로 전부 열기 부담.

이 둘을 묶어 "**구글 로그인 + 매니지드 DB(Supabase) + 결제**" 로 푼다. **자체 서버는 띄우지
않는다** — Supabase(Postgres + Auth + Edge Functions) 와 결제 제공자만 쓴다.

## 목표

- 사용자가 로그인하면 어느 기기에서든 **통계가 동기화**된다.
- **무료 / 유료 티어**를 둔다. 유료는 지정 날짜 범위 발행 등 비용 큰 기능.
- 백엔드 인프라 운영 부담 최소화(서버리스 · 매니지드).

## 티어 구분 (초안)

| 기능 | 무료 | 유료 |
|------|------|------|
| 오늘/이번주/이번달 발행 | ✅ | ✅ |
| 일간 백필 | 최근 7일 | 임의 시작~종료 범위 |
| 통계 대시보드 | ✅(로컬) | ✅ |
| 크로스기기 동기화 | ❌ 또는 제한 | ✅ |
| 발행 취소 | ✅ | ✅ |

→ 지정 날짜 범위 백필 UI 는 **유료 게이팅**. 무료에선 지금처럼 7일 고정.

## 아키텍처 (서버리스)

- **Auth**: Supabase Auth + Google OAuth. Electron 에선 시스템 브라우저로 OAuth →
  deep link(custom protocol `cairn://`)로 토큰 콜백 수신 → 세션 저장(keychain).
- **DB**: Supabase Postgres. Row-Level Security 로 `user_id = auth.uid()` 본인 데이터만.
- **결제**: 결제 제공자(예: Stripe Checkout) → 웹훅을 Supabase Edge Function 으로 받아
  `subscriptions` 테이블 갱신. 앱은 구독 상태를 읽어 유료 기능 게이팅.
- **서버 없음**: 앱 ↔ Supabase 직접(anon key + RLS). 민감 작업만 Edge Function.

## 데이터 모델 (초안)

- `worklog_stats(user_id, date, category, pr, commit, hours int[24], updated_at)` —
  로컬 `worklog-stats.json` 과 동일 스키마. PK `(user_id, category, date)`.
- `subscriptions(user_id, tier, status, current_period_end)`.
- 동기화: 로컬이 진실 소스(오프라인 우선) → 발행 시 로컬 기록 후 best-effort upsert.
  로그인 시 원격 → 로컬 머지(`updated_at` 최신 우선). 충돌은 최신 승.

## 보안 / 프라이버시 (ADR 0003 준수 — 중요)

- **동기화 대상은 통계 카운트·시간대 히스토그램·날짜뿐.** 코드 본문·diff·절대경로·토큰·
  PR 제목/본문은 **절대 업로드 금지**. `worklog_stats` 컬럼에 그런 필드를 두지 않는다.
- 노션 토큰·GitHub 토큰·Claude 토큰은 계속 **로컬 keychain 전용**, DB 에 올리지 않는다.
- 업로드 페이로드도 `assertNoForbiddenPayload` 류 검사로 fail-closed.
- 이 결정은 착수 시 ADR 로 남긴다(0003 확장 — "동기화 화이트리스트").

## 단계 (착수 시 PR 단위)

1. 플랜 확정 + ADR(동기화 화이트리스트, 결제/티어 정책).
2. Supabase 프로젝트 + 스키마 + RLS. 로컬 only 동작은 그대로(로그인 선택).
3. 앱 내 Google 로그인(시스템 브라우저 + deep link), 세션 keychain 저장.
4. `worklog_stats` 양방향 동기화(오프라인 우선 머지). 새 기기 = 원격 pull.
5. 결제 연동 + 구독 상태 게이팅. 지정 날짜 범위 백필 UI 를 유료로 오픈.
6. 무료/유료 경계 UX(업셀, 제한 안내).

## 비범위 / 유의

- 자체 백엔드 서버 운영 안 함.
- 노션 일지 본문 동기화는 안 함(노션이 이미 그 역할 — cross-device 로 노션은 공유됨).
- 무료 사용자는 지금과 동일하게 100% 로컬로 동작해야 한다(로그인 강제 금지).

## 참고 — 같이 본 즉시 수정 사항(이미 반영)

- 백필 진행 UI: 선형 스텝(수집→요약→발행)은 "한 번에 모아 처리"처럼 보였으나 실제는
  날짜별 동시 처리. → 백필이면 트리거 시점부터 **일자별 배치 UI**(N/M + 동시 처리 안내)로
  전환 완료. 발행 취소 버튼도 추가.
