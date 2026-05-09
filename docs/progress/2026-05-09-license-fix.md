# 2026-05-09 — license github detection fix

> 진행 단계: 단계 4 ~ 5 사이 미니 PR
> 상태: 완료

## 완료

- `LICENSE` 파일을 standard AGPL v3 전문 (gnu.org/licenses/agpl-3.0.txt) 그대로 — 이전 PR #15 의 17 줄 cairn 헤더 + separator 제거
- copyright attribution 은 LICENSE 에 안 적고 README License 섹션 ("Copyright (C) 2026 Donghyeok Lim") 에만 명시 — Mastodon / brightbean-studio 같은 AGPL OSS 의 표준 패턴
- GitHub 의 license 자동 인식(`licensee` 라이브러리) 100% 통과 → repo 우측 sidebar 에 "GNU Affero General Public License v3.0" 표시
- patch bump `0.5.4 → 0.5.5`

## 시행착오 / 결정

- **GitHub license 인식 실패 원인**: PR #15 의 LICENSE 가 cairn 헤더 (~17 줄) + separator + AGPL 전문 형태였음. licensee 가 매칭 못 해서 sidebar 에 "View license" 만 표시됨
- **AGPL 전문만 LICENSE 에 두는 게 표준**: copyright / project 명시는 별도 (README / NOTICE) 가 GitHub OSS 컨벤션. 다른 유명 OSS (NestJS / Next.js 등) 도 LICENSE 는 standard 전문, copyright 는 README 또는 코드 헤더
- **GPL vs AGPL 다시 검토**: GPL 은 SaaS / 네트워크 서비스 형태 노출 시 소스 공개 의무 없음 (ASP loophole). AGPL 은 그것도 강제. cairn 미래 데스크톱 앱 / SaaS 형태 가능성 견제하려면 AGPL 이 robust → AGPL 그대로 유지

## 다음

- 단계 5 — Summarizer agent harness
