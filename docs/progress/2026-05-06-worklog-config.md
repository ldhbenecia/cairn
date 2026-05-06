# 2026-05-06 — worklog config

> 진행 단계: **2 — 로컬 Git 수집** (첫 PR / 2개 분할 중)
> 상태: 완료

## 완료

- `.gitignore` 에 `worklog.config.json` 추가 + `worklog.config.example.json` 커밋 (절대경로 머신별이라 본 파일은 머신 외부 미공개)
- `src/config/env.schema.ts` — `CAIRN_CONFIG_PATH` (optional) 추가
- `src/config/app-config.service.ts` — `cairnConfigPath` getter (SecretsService 패턴과 일관)
- `src/worklog-config/worklog-config.schema.ts` — zod (`localGitRepos: string[].default([])`)
- `src/worklog-config/worklog-config.service.ts` — lazy load + 캐시. 파일 있으면 zod 검증, 없으면 빈 config(`{ localGitRepos: [] }`) fallback + warn 1회. 기본 경로 `process.cwd()/worklog.config.json`, env override 가능
- `src/worklog-config/worklog-config.module.ts` — provider + export
- `AppModule` 에 `WorklogConfigModule` import 등록
- `.env.example` 에 `CAIRN_CONFIG_PATH=` 추가
- typecheck / lint / build 통과
- patch bump `0.2.0 → 0.2.1`

## 진행 중

- (없음 — PR #8 마감)

## 추가 (PR 진행 중 합쳐진 작업)

- **CLAUDE.md 재구성**: "Behavioral guidelines to reduce common LLM coding mistakes" 4 섹션 + 마지막 `## Project context (cairn)` 섹션. 기존 cairn 특화 내용은 룰/ADR 인덱스 형태로만 남김.
- **`.claude/rules/work-start-checklist.md`** 신설 — 작업 시작 시 progress/ADR/plan/룰 잡는 순서 (기존 CLAUDE.md "작업 시작 전 체크" 발췌)
- **`.claude/rules/git-conventions.md`** 신설 — 브랜치/커밋/PR 컨벤션. subject 한국어 명사구 우선, body bullet 강제, Co-Authored-By 는 자유
- **README.md 영어 정리** — 한국어·주저리주저리·아키텍처 다이어그램 제거, 표준 OSS 톤 (Description / Status / Requirements / Setup / Commands / Usage / Documentation / License)

## 시행착오 / 결정

- **파일명 = `worklog.config.json` (plan 그대로)**: cairn 으로 이름 바꾼 후에도 plan 표기는 worklog.config.json. 새 이름(`cairn.config.json`)으로 갈지 고민했지만 plan 결정 뒤집을 가치 없어서 plan 따름.
- **위치 = repo root + `.gitignore`** (절대경로 머신마다 달라서). 기본 경로는 `process.cwd()/worklog.config.json`. launchd 가 다른 cwd 로 부팅할 수 있어 `CAIRN_CONFIG_PATH` env override 제공.
- **부팅 시 검증 vs lazy**: 파일 있으면 zod schema 검증해서 fail-fast, 없으면 빈 config(`{ localGitRepos: [] }`) fallback. `--source=github` 만 돌릴 때 config 파일 강제하지 않기 위해. collector 가 호출됐는데 repos 비어 있으면 PR #9 에서 warn + 빈 활동 반환.
- **NestJS 컨벤션**: 파일명 `worklog-config.service.ts` (kebab-case + suffix), 클래스 `WorklogConfigService`, 디렉토리 `src/worklog-config/` (단일 책임 어댑터라 단수). `AppConfigModule` 이 `@Global` 이라서 명시 import 없이 `ConfigService` / `AppConfigService` 주입 가능.
- **`CAIRN_CONFIG_PATH` 도 AppConfigService 통해 노출**: github-api.client 가 SecretsService 통해 GITHUB_TOKEN 읽는 패턴과 일관.

## 다음

- 이 PR 머지 → PR #9 (`feature/local-git-collector`)
  - `simple-git` 의존 추가
  - `LocalGitClient` (commits + pushed check via `git branch -r --contains`)
  - `LocalGitCollectorService` — KST→UTC 윈도우, `--no-merges`, short SHA + branch + pushed 분류
  - `LocalGitActivity` 화이트리스트 타입 (full SHA / 본문 / 절대경로 / author email 정의 X)
  - Orchestrator daily 분기에 합치기
  - 단계 2 ✅ + minor `0.3.0`
