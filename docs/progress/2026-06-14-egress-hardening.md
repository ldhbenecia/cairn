# 2026-06-14 — egress-hardening

> 진행 단계: **보안 — 외부 송신(egress) 가드 강화**
> 상태: 완료

## 완료
- core 전 egress 경로 감사 (Explore 에이전트). GitHub 경로는 PR body·commit subject 를 항목 단위 검사·drop 으로 보호되나, **local-git commit subject 는 개별 검사가 없어** 최종 payload 백스톱에만 의존 — subject 하나에 금지 패턴이 있으면 발행 전체가 throw 로 중단되는 비대칭 발견.
- `local-git-collector.service.ts`: `isForbiddenSubject` 사전 필터 추가 — GitHub 경로와 대칭으로 위반 commit 만 drop+warn 후 계속.
- 테스트 +8 (46 → 54):
  - `local-git-collector.spec.ts` (신규): `isForbiddenSubject` — 정상 subject 통과, 절대경로·토큰·diff 마커 차단.
  - `rollup-tools.spec.ts` (신규): rollup payload egress 가드 — clean 통과 + daily 요약 텍스트로 새는 diff hunk 차단. (런타임 가드는 있었으나 무테스트였음)
  - `summarizer-tools.spec.ts`: 최종 payload 백스톱 negative case 추가.
- core 0.18.1 → 0.18.2 (patch, 보안 — ADR 0020 기준).

## 시행착오 / 결정
- ADR 0003 의 강제 수단 (3) "redaction 마스킹 헬퍼"가 미구현 상태였음. 그대로 구현하려다, `(api_key|token|secret|password)\s*[:=]` 정규식을 **자유 텍스트 커밋 subject** 에 적용하면 `fix: password: reset` 같은 정상 subject 를 오탐 훼손함을 확인.
- → 마스킹 대신 **fail-closed 검사 + 소스별 graceful drop** 으로 강제 방식을 확정하고 **ADR 0021** 로 기록. `security-egress.md` 강제 수단 (3) 도 현실에 맞게 갱신.

## 다음
- 이 fix 는 다음 desktop 릴리스에 함께 실림 (core 는 desktop 빌드 시 번들). 단독 태그 없음.
