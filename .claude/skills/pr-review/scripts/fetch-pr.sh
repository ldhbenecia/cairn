#!/usr/bin/env bash
# PR 메타데이터 + diff 수집 — pr-review 스킬 1단계
# 사용법: ./scripts/fetch-pr.sh <PR번호>
# 예시:   ./scripts/fetch-pr.sh 1234
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "사용법: $0 <PR번호>" >&2
  exit 1
fi

PR=${1#\#}

echo "=== META ==="
gh pr view "$PR" --json number,title,body,baseRefName,headRefName,files
echo
echo "=== DIFF ==="
gh pr diff "$PR"
