# 0017. 익명 사용량 텔레메트리 (opt-out, PostHog)

- 상태: accepted
- 작성일: 2026-06-04

## 맥락

일반 사용자 배포를 시작하면 "몇 명이 쓰는지 / 어떤 버전을 쓰는지 / 발행이 도는지" 를 알 방법이 없다. 다운로드 수만으론 active user·재방문을 모른다. 사용자는 **정확한 지표를 대시보드로 보고 싶다**고 명시했다.

제약:
- 코드 본문·diff·파일 내용·토큰·회사 식별정보는 **한 바이트도** 외부로 보내지 않는다 (ADR 0003).
- 자체 서버는 띄우지 않는다 (ADR 0002 — 무과금·portable). SaaS/BaaS 만.
- 개인 작업 일지 도구인 만큼 텔레메트리도 익명·최소 원칙을 지킨다.

## 결정

**익명 이벤트 텔레메트리를 opt-out 으로 도입. 백엔드는 PostHog (무료 cloud tier).**

- **opt-out**: 기본 켜짐. Preferences 토글로 끌 수 있고, 온보딩/README 에 명시 공지. (opt-in 은 동의자만 잡혀 사용자 수가 과소 집계되므로, 정확한 카운트가 목적인 이번엔 opt-out.)
- **익명 식별**: 첫 실행 시 로컬에서 생성하는 **랜덤 install UUID**(v4)를 PostHog `distinct_id` 로 사용. 이름·이메일·계정 등 PII 아님. 이걸로 고유 설치 수·retention·버전 분포를 *정확히* 집계.
- **node SDK(posthog-node) 를 main 프로세스에서** 사용 → autocapture 없음(명시 이벤트만). IP 기반 geo 는 끄거나(`$geoip_disable`) 국가 수준만 허용, 세션 레코딩 등 미사용.
- **보내는 것 (화이트리스트)**: install UUID, 앱 버전, OS/arch, 그리고 이벤트 — `app_launched`, `publish`(props: mode=daily|weekly|monthly, outcome=ok|fail|no-activity). 끝.
- **절대 안 보내는 것**: 워크로그 내용, PR 제목, repo 이름, 커밋 메시지, 파일 경로, 토큰, 이메일, 사번, 활동 카운트 등 식별 가능 정보.
- **project API key(ingest, write-only)** 는 빌드 설정/환경으로 주입. 없으면 텔레메트리 graceful 비활성(개발·미설정 환경).

## 대안

- **opt-in** — 가장 보수적이나 사용자 수 과소 집계. 목적(정확한 카운트)과 상충.
- **Aptabase** — 데스크톱 privacy-first 라 셋업은 더 간단하나, 영구 고유 식별자를 의도적으로 안 써서 "정확한 고유 사용자 수·retention" 이 약함. "정확히 보고 싶다" 요구에 덜 맞음.
- **Supabase 커스텀 ingest** — 통제·향후 billing 연계엔 좋지만 대시보드를 직접 만들어야 함. billing 시점에 재검토(라이선스 상태 저장 용도로는 여전히 유력).
- **GitHub 다운로드 수만** — 구현 0 이지만 active user·재방문을 모름. 보조 신호로만.

## 결과

- **장점**: 배포 후 고유 사용자·DAU/MAU·retention·버전 분포·발행 성공률을 PostHog 대시보드로 파악. 코드/내용 egress 0 (이벤트 카운트만이라 ADR 0003 과 무관).
- **트레이드오프**:
  - opt-out 이라 **고지 의무** — 온보딩/README/Preferences 에 명확히 안내해야 신뢰 유지.
  - PostHog cloud 의존(무료 tier 한도, EU/US 호스트 선택). 한도/이전 시 셀프호스트 가능(오픈소스).
  - ingest key 가 빌드에 포함(공개 레포면 노출) — write-only 라 피해 제한적이나 빌드 시 주입 권장.
- **강제 수단**:
  - 송신 페이로드 타입에 식별 필드를 두지 않음. 이벤트 props 는 enum(mode/outcome)만.
  - 단위 테스트로 페이로드 `JSON.stringify` 후 금지 키워드(`diff|token|repo 이름 패턴|@`) 검사 (ADR 0003 패턴 재사용).
  - 텔레메트리 모듈은 화이트리스트 함수(`trackAppLaunched`, `trackPublish`)만 노출 — 임의 객체 전송 API 비노출.

## 관련

- ADR 0002 (자체 서버 X — SaaS/BaaS 만), ADR 0003 (코드/내용 egress 금지)
- 플랜: `docs/plans/2026-06-03-feedback-update-prompts.md` 그룹 4(이전엔 Aptabase 적었으나 "정확한 지표+대시보드" 요구로 PostHog 채택), `docs/plans/2026-06-04-release-auto-update.md`
- billing/후원·라이선스 상태는 별도(향후, Supabase 후보) — 이 ADR 은 익명 사용량 한정
