# 2026-06-14 — summary-model-select

> 진행 단계: **성능 — 요약 속도 개선 (모델 선택)**
> 상태: 완료

## 완료
- core: `summary-model.ts` — `CAIRN_SUMMARY_MODEL`(sonnet/haiku/opus) → Agent SDK `query().options.model`. daily·rollup 양쪽 배선. 별칭만 허용(알 수 없는 값은 override 안 함). 단위 테스트 +3.
- desktop: `settings.summaryModel`(기본 sonnet) + Preferences 프롬프트 탭 세그먼트 선택 UI(Haiku·Sonnet·Opus·기본 + 속도/품질 힌트) + core-runner env 전달 + 타입 미러(preload·cairn-api) + i18n(ko/en).
- ADR 0022 (모델 선택·기본 sonnet), 버전 minor bump.

## 시행착오 / 결정
- 발행 시간의 96% 가 요약(123s). 수집·발행은 이미 최적화 → 유일한 큰 레버는 모델.
- 요약은 도구가 구조화 데이터를 주고 모델은 한국어 정리만 하므로 Opus 가 과함 → **기본 Sonnet**. Opus 는 롤업 최고 품질용 옵션으로 유지. → ADR 0022.
- 모델 ID 하드코딩(`claude-sonnet-4-6`) 대신 별칭(`sonnet`) 전달 — CLI 가 해석, rot 회피.
- egress 무영향 — payload 는 모델과 무관하게 동일 검사(ADR 0021).

## 다음
- 발행 결과 화면에 사용 모델·소요 시간 노출(백로그).
