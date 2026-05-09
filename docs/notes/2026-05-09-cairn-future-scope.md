# 2026-05-09 — cairn future scope

> 상태: 아이디어 (실행 시점 단계 8 이후)

## 떠오른 것

단계 5 (Summarizer) 진입 시점에 인증 / 셋업 패턴 잡으면서 짚은 미래 비전. v1 cairn 은 CLI + 개발자 사용자 가정인데, 이 가정 깨질 시나리오 정리.

## 시나리오 1 — 데스크톱 앱 GUI 인증 (개발 비-사용자)

`.env` 에 API key 박거나 secret hash 코드 수정하는 셋업은 개발자에게도 번거로운데, **개발 모르는 사용자에게는 사실상 진입 장벽**.

단계 8 이후 monorepo + 데스크톱 앱 (메모 [2026-04-27-desktop-viewer-idea](2026-04-27-desktop-viewer-idea.md)) 시점에:

- 앱 안 webview 로 OAuth flow (Anthropic 이 third-party OAuth 공식 지원 시) 또는 Claude Code 인증 인계 안내 GUI
- API key 입력 form (fallback 으로)
- Notion integration 발급 / connect 도 앱이 안내 (튜토리얼 형태)
- `worklog.config.json` / `.env` 직접 편집 X — 앱 settings UI 가 흡수

→ 데스크톱 앱이 사용자 인증 / 셋업의 모든 manual step 흡수. cairn core (CLI) 그대로, 앱이 wrap.

## 시나리오 2 — 데이터 소스 추상화

v1 은 GitHub + 로컬 Git + Notion 가정. 다른 사용자 케이스:

- **GitLab / Bitbucket 사용자** — 회사가 GitHub 외 host 사용. 회사 GitLab + 개인 GitHub 같은 혼합도 흔함
- **개발 안 하는 사용자** — git 자체 안 씀. Notion + 일정 + 이메일 같은 source 만 모니터
- **다른 메모 도구** — Obsidian / Roam / Logseq 같은 마크다운 vault 도 source

미래 design — `Collector<Activity>` 인터페이스 추상화:

```typescript
interface Collector<A> {
  source: string;
  collect(date: string): Promise<A>;
}
```

worklog.config.json 에서 활성 collector 선택:
```json
{
  "sources": ["github", "gitlab", "notion", "obsidian"]
}
```

각 source 는 별도 plugin (`packages/collector-gitlab` 같은 식 — monorepo 시점). 비-Git 사용자는 git 관련 collector 모두 비활성, Notion / 일정만.

## 시나리오 3 — Notion 외 출력처

일지 발행도 Notion 만이 아닐 수 있음:

- Obsidian vault 에 markdown 파일로
- Apple Notes
- 본인 블로그 (Hugo / Jekyll 등)
- 단순 로컬 파일

`Publisher` 인터페이스 추상화 — collector 와 같은 패턴.

## 운영 결정 / 우선순위

- **v1 ~ v1.x** (현재 작업 중): CLI + 개발자 가정 그대로. 단계 8 까지 완성 후 v1.0 release
- **v1.1 ~ v1.x** (단계 8 이후): 데스크톱 앱 시작 (monorepo refactor + GUI shell). 미래 시나리오 1
- **v2** : 미래 시나리오 2 / 3 — 데이터 소스 추상화 + 출력처 추상화. 별도 ADR + 점진적 plugin 추가

## 다음

- 단계 5 ~ 7 진행 후 v1.0 release. 그 시점에 이 메모 다시 보고 우선순위 재검토
- 의미 있어지는 시점에 별도 ADR 또는 plan 파일로 승격
