# 2026-06-03 — remove-notion-source

> 진행 단계: **Notion 활동 소스 제거 + 출력 언어 = 앱 설정 + 프롬프트 정리** (완료)
> 상태: 완료

## 완료
### Notion 활동 소스 제거
- Notion 편집 트래킹(소스)을 완전히 제거 — collector(`notion-collector.service.ts`)·contract(`notion-activity.types.ts`) 삭제, `notion.module` provider 정리, orchestrator 수집/카운트/입력에서 제거, `--source=notion` 폐기(`RunSource`/VALID_SOURCES)
- summarizer 입력에서 notion 제거(SummarizerInput·computeNotes·notes·notion 에러). notesBullets 출력 필드는 유지(롤업이 파싱)
- 발행 "Source counts" 에서 notion 드롭 → `gh:N / git:N`
- Notion 발행(출력)·notionWorkspaces config 는 그대로 (소스만 제거)

### 출력 언어 = 앱 설정 언어
- `--lang`(ko|en) 추가 → `RunOptions.lang`. 데스크톱 core-runner 가 `readSettings().language` 를 전달
- daily/rollup summarizer 프롬프트의 "Output language MUST be {Korean|English}" 동적화
- 기본 ko (CLI/launchd backward-compat)

### 프롬프트 정리 (토큰·품질)
- 영어 지시문으로 통일(혼용 한국어 제거), "cairn"·"backend" 등 불필요 하드코딩 제거("a developer")
- 예시·중복 Style 축소로 토큰 절감
- **outcome 강조**: 커밋 나열이 아니라 PR.body 기반으로 성과·성능 개선·결과를 뽑도록 지시 강화

### 기타
- cli-args 의 KST 하드코딩(`kstIsoDateOffset`) → 로컬 TZ(`localIsoDateOffset`) (ADR 0016)
- 데스크톱 리스트 source counts 를 PR/커밋 **아이콘**으로 표시(gh/git 구분 명확, notion 제거). 과거 페이지의 `notion:0` 문자열도 파싱해서 무시

## 시행착오 / 결정
- notesBullets 출력은 유지: 롤업 collector 가 일지의 notes 섹션을 파싱하므로 제거 시 영향 큼 → notion 입력만 제거(출력 포맷 불변)
- summarize() 시그니처 `(input, lang)` 으로 통일(daily/rollup)

## 다음
- 출력 언어별 프롬프트 예시(현재 예시 최소화), 사용자 정의 프롬프트(그룹 3)
