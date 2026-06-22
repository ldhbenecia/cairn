#!/usr/bin/env bash
# PR 제목 포맷터 — `<type>(<scope>): <title>` 출력
# cairn PR 제목은 커밋 제목과 동일한 Conventional Commits 형식이라
# 포맷 로직을 commit-msg.sh 에 위임한다 (단일 출처).
# 사용법: ./scripts/pr-title.sh <type> <scope> <title...>
# 예시:   ./scripts/pr-title.sh chore agent-setup "Codex/Claude 세팅 정리 및 git 컨벤션 스크립트화"
#         → chore(agent-setup): Codex/Claude 세팅 정리 및 git 컨벤션 스크립트화
# 상세 컨벤션: .claude/rules/git-conventions.md
set -euo pipefail

exec "$(dirname "$0")/commit-msg.sh" "$@"