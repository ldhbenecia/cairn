# cairn

> 등산로의 돌탑처럼, 매일 작업 흔적 하나씩 쌓아 길을 남긴다.

**cairn**은 백엔드 개발자 한 명의 하루 작업을 자동으로 모아 Notion 일지로 발행하는 개인용 도구다. 매일 저녁, 그날의 GitHub PR/리뷰·로컬 Git 커밋·Notion 편집 활동을 한 페이지로 정리한다. 매주·매월 자동 롤업도 만들어 평가/회고 시즌에 쓸 이력을 무인 누적한다.

이 레포 자체가 "본인이 한 일을 기록하는 시스템"이라, 레포 안의 [docs/progress/](docs/progress/)도 같은 패턴으로 cairn을 만들어가는 과정을 일지처럼 누적하고 있다 (메타-자기참조).

---

## Status

🚧 **단계 0** — 레포 + 문서 + 품질 도구 셋업 중. 실행 가능한 코드 아직 없음.

진행 상황: [docs/progress/README.md](docs/progress/README.md)

---

## What it does (목표 동작)

매일 19:00 (KST), launchd가 cairn을 1회 실행한다.

```
[GitHub Search API]   ──┐
[로컬 Git log]         ──┼──▶  Claude Agent SDK (한국어 요약/분류)  ──▶  Notion 일지 페이지
[Notion search API]   ──┘
```

- **수집**: 본인이 그날 만든/머지한 PR, 리뷰, 코멘트 + 로컬 여러 저장소의 본인 커밋 (push 안 한 것 포함) + Notion에서 본인이 편집한 페이지
- **요약**: Claude Agent harness가 도구를 호출하며 한국어 단락 + Done/In Progress/Notes 섹션 작성
- **발행**: Notion DB에 일자별 페이지 생성 (멱등성 보장 — 같은 날 두 번 실행해도 1개만)
- **롤업**: 매주 월요일에 지난주 7개 일지를 모은 주간 정리, 매월 1일에 지난달 일지를 모은 월간 정리 자동 생성

---

## Why (왜 만드나)

회사에서 한 일이 GitHub·Notion·Slack에 흩어져 있다. 평가 시즌·회고 때 이력을 모으면 항상 빠진 게 있다. 매일 잡일 사이에서 "오늘 뭐 했지"를 정리하는 맥락 전환 비용도 크다.

cairn은 그 정리 작업을 무인화한다. 본인은 그냥 일하고, 저녁에 노트북이 알아서 일지를 만든다. 한 달이 지나면 30개의 페이지가, 1년이 지나면 365개가 누적되어 있다.

---

## 핵심 원칙 (비협상)

| 원칙 | 의미 | 출처 |
|------|------|------|
| 추가 과금 0원 | Anthropic API 직접 호출 X. Claude Agent SDK로 본인 Max 구독 quota 안에서만 동작 | [ADR 0001](docs/decisions/0001-use-claude-agent-sdk.md) |
| 코드 본문 외부 송신 금지 | diff·파일 본문·절대경로·이메일은 외부 API에 한 바이트도 보내지 않음 (메타데이터만) | [ADR 0003](docs/decisions/0003-no-code-body-egress.md) |
| 클라우드 X | 로컬 macOS launchd만. Docker·Railway 등 사용 X | [ADR 0002](docs/decisions/0002-portable-deploy.md) |
| 공식 docs 우선 | NestJS 등 라이브러리는 공식 문서가 최우선 출처 | [ADR 0004](docs/decisions/0004-nestjs-conventions.md) |

---

## Requirements

- macOS (launchd 의존)
- Node 24 LTS (`.nvmrc` 참조, `nvm install --lts`)
- pnpm 10+
- **Claude Pro/Max 구독** (Agent SDK 호출용)
- GitHub Fine-grained PAT (private repo Read-only)
- Notion Internal Integration 토큰

본인 외 사용자가 cairn을 돌리려면 Claude Pro/Max 구독이 필요하다 (ADR 0001).

---

## Quick start

> 셋업 가이드 상세는 단계 8에서 [docs/SETUP.md](docs/SETUP.md)로 작성 예정.

```bash
git clone <repo-url> cairn
cd cairn
nvm use            # Node 24 LTS
pnpm install       # husky 자동 활성화
cp .env.example .env  # 토큰 채워넣기 (단계 1+에서 .env.example 추가됨)
pnpm typecheck && pnpm lint && pnpm test
```

---

## 아키텍처 (한눈에)

```
launchd (실행 머신)
  └── 정해진 시각에 1회 실행
       │
       ▼
   node dist/main.js --mode={daily|weekly|monthly}
       │
       ▼
   NestJS standalone application (HTTP X, createApplicationContext)
       ├── GithubModule        ─┐
       ├── LocalGitModule      ─┼─▶  Collectors (메타데이터만)
       ├── NotionModule        ─┘
       │
       ▼
   SummarizerModule (Claude Agent SDK harness)
       └── 도구 호출 루프 → 한국어 요약 JSON
       │
       ▼
   NotionPublisher → Notion DB 페이지
```

전체 설계: [docs/plans/2026-04-26-cairn-overall.md](docs/plans/2026-04-26-cairn-overall.md)

---

## 문서 인덱스

| 위치 | 내용 |
|------|------|
| [CLAUDE.md](CLAUDE.md) | Claude Code 작업 컨텍스트 (이 레포에서 작업할 때 자동 로드) |
| [docs/plans/](docs/plans/) | 살아있는 plan (날짜별 누적) |
| [docs/progress/](docs/progress/) | 작업 일지 (날짜별 누적) + 단계 진행률 |
| [docs/decisions/](docs/decisions/) | ADR (비자명한 결정) |
| [.claude/rules/](.claude/rules/) | Claude가 따라야 할 세부 규칙 |

---

## Contributing

이 레포는 본인용 도구라 외부 기여는 받지 않는다. 다만 코드/구조는 공개되어 있어 비슷한 도구를 만드는 참고용으로 자유롭게 사용·포크 가능.

PR/커밋 컨벤션은 [.github/pull_request_template.md](.github/pull_request_template.md)와 ADR 0005 참조.

---

## License

UNLICENSED (개인 도구). 코드 참고 시 별도 합의 없이 자유롭게.
