#!/usr/bin/env bash
# 커밋 전 prettier + eslint --fix 실행
# 스테이지된 .ts/.tsx 파일에만 적용 — 무관 파일은 건드리지 않음
#
# 사용법:
#   git add <files>
#   ./scripts/precommit.sh
#   git commit -m "$(./scripts/commit-msg.sh ...)"
#
# eslint --fix가 자동 수정 불가한 에러는 종료코드 1로 차단함

set -euo pipefail

files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)

if [ -z "$files" ]; then
  echo "No staged TS files — skipping prettier/eslint"
  exit 0
fi

echo "==> prettier --write (staged TS files)"
echo "$files" | xargs pnpm exec prettier --write

echo "==> eslint --fix (staged TS files)"
if ! echo "$files" | xargs pnpm exec eslint --fix; then
  echo
  echo "eslint가 자동 수정하지 못한 에러가 남음 — 위 메시지를 보고 수동 수정 후 다시 시도" >&2
  exit 1
fi

echo "==> re-staging fixed files"
echo "$files" | xargs git add

echo
echo "OK — 이제 commit 가능"
