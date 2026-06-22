#!/usr/bin/env bash
# 커밋 메시지 제목 포맷터 — `<type>(<scope>): <subject>` 출력
# 사용법: ./scripts/commit-msg.sh <type> <scope> <subject...>
# 예시:   ./scripts/commit-msg.sh fix desktop "Dock 리스너를 macOS 한정으로"
#         → fix(desktop): Dock 리스너를 macOS 한정으로
#
# cairn scope 는 브랜치명이 아니라 도메인 영역(github/local-git/summarizer/
# desktop/core/release/state/ops/config ...). 그래서 scope 는 인자로 받는다.
# 상세 컨벤션: .claude/rules/git-conventions.md
set -euo pipefail

VALID_TYPES="feat fix refactor perf docs test chore build ci style revert"

if [ $# -lt 3 ]; then
  echo "사용법: $0 <type> <scope> <subject...>" >&2
  echo "  type: ${VALID_TYPES}" >&2
  exit 1
fi

TYPE=$1
SCOPE=$2
shift 2
SUBJECT="$*"

if ! echo "$VALID_TYPES" | tr ' ' '\n' | grep -Fqx "$TYPE"; then
  echo "에러: 알 수 없는 type '$TYPE' (허용: ${VALID_TYPES})" >&2
  exit 1
fi

echo "${TYPE}(${SCOPE}): ${SUBJECT}"