# Plans

> 살아있는 plan을 날짜별로 누적. 큰 그림 plan, 새 기능/모듈 sub-plan, 리팩터·재설계 plan 모두 여기에.
> 파일명: `YYYY-MM-DD-<slug>.md` (KST, slug는 kebab-case)

## 인덱스 (시간 역순)

- [2026-04-26 — cairn 전체 설계 (overall)](2026-04-26-cairn-overall.md) — 단계 0 시작 시점의 큰 그림. 단계별 구현 순서, 디렉토리 구조, 보안·비용 정책.

## 작성 규칙

- 새 plan이 필요해질 때 새 파일 생성 (예: `2026-05-15-github-collector.md`, `2026-06-02-summarizer-redesign.md`)
- 큰 그림 plan은 그대로 두고, 변경/세부화는 새 plan 파일로 (이전 것은 superseded 표시)
- plan과 progress는 분리:
  - **plan** = "어떻게 만들 것인가" 설계 문서 (앞으로의 의도)
  - **progress** (`docs/progress/`) = "어떻게 만들었는가" 작업 일지 (지난 흐름)
- plan에서 **장기 결정**은 ADR(`docs/decisions/`)로도 이관

## superseded 표시

```markdown
> 상태: superseded by [YYYY-MM-DD-<new-slug>](YYYY-MM-DD-<new-slug>.md) — <한 줄 사유>
```
