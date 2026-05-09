# 2026-05-09 — license AGPL v3

> 진행 단계: 단계 4 ~ 5 사이 미니 PR
> 상태: 완료

## 완료

- `LICENSE` 파일 신규 — cairn header (Copyright 2026 Donghyeok Lim) + AGPL v3 전문 (gnu.org/licenses/agpl-3.0.txt 그대로)
- `package.json` license 필드 `UNLICENSED` → `AGPL-3.0-or-later` (SPDX 식별자)
- `README.md` License 섹션 — AGPL 의 핵심 의무 (네트워크 서비스 형태로 노출 시에도 소스 공개) 명시
- patch bump `0.5.3 → 0.5.4`

## 시행착오 / 결정

- **AGPL v3 선택 이유**: 사용자 의도 — 코드 보기 자유 + fork 자유 + "자기 거인 양" 사용 차단. AGPL 의 강한 copyleft 가 파생물도 AGPL 강제 → 누가 cairn 가져가서 closed-source 화 못 함. MIT / Apache 는 attribution 만 받고 자유라 의도 안 맞음
- **AGPL 거부감 vs 미래 완화 가능성**: 사용자가 짚은 대로 AGPL 이 사용자/상업 이용에 거부감 줄 수 있음. 본인이 유일 contributor 인 동안은 결정만으로 라이센스 변경 가능 (외부 PR contributor 가 생기면 동의 필요). 운영 패턴: 초기 AGPL → 도구 안정화 / 사용자 확장 시점에 MIT 등으로 완화 가능. 단 변경 전 시점에 받은 fork 는 그 시점 AGPL 영구 적용
- **`private: true` + license 필드 양립**: package 자체는 npm publish 안 함 (private). license 필드는 GitHub 에 공개된 코드의 라이센스 명시 용도. 둘 다 양립 OK
- **LICENSE 파일 형식**: cairn 헤더 (짧은 attribution) + AGPL v3 전문. gnu.org 의 standard plain text 그대로 첨부. 줄 수 ~680 (대부분 AGPL 전문)
- **별도 ADR 안 만든 이유**: 운영 정책 결정이지만 plan/CLAUDE.md 의 "비협상 핵심 원칙" 도 아니고 추후 변경 가능성 있는 결정. progress 일지의 "시행착오 / 결정" 으로만 기록. 미래 라이센스 변경 시점에 ADR 추가 검토 가능

## 다음

- 단계 5 — Summarizer agent harness (Claude Agent SDK + 외부 송신 sanitize + redaction 단위 테스트 + ADR 0009)
