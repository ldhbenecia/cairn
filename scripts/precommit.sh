#!/usr/bin/env bash
# 커밋 전 prettier + eslint --fix 실행 (스테이지된 .ts/.tsx)
#
# eslint 는 파일이 속한 패키지에서 실행한다 — 패키지마다 eslint 버전/설정이 달라
# (web=eslint9+next, core/desktop=루트 eslint10) 루트에서 일괄 실행하면 버전 불일치로 깨진다.
# prettier 는 루트 설정 하나로 일관 적용.
#
# 사용법:
#   git add <files>
#   ./scripts/precommit.sh
#   git commit -m "$(./scripts/commit-msg.sh <type> <scope> ...)"

set -euo pipefail

root=$(git rev-parse --show-toplevel)
files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)

if [ -z "$files" ]; then
  echo "No staged TS files — skipping prettier/eslint"
  exit 0
fi

echo "==> prettier --write (staged TS files)"
echo "$files" | xargs pnpm exec prettier --write

fail=0
run_eslint() { # $1 = dir(루트 상대, "." 가능), 나머지 = 그 dir 기준 상대 파일들
  local dir="$1"
  shift
  echo "==> eslint --fix ($dir)"
  if ! (cd "$root/$dir" && printf '%s\n' "$@" | xargs pnpm exec eslint --fix); then
    fail=1
  fi
}

pkgs=$(echo "$files" | sed -nE 's#^(packages/[^/]+)/.*#\1#p' | sort -u)
for pkg in $pkgs; do
  rel=$(echo "$files" | sed -nE "s#^$pkg/##p")
  # shellcheck disable=SC2086
  run_eslint "$pkg" $rel
done

rootfiles=$(echo "$files" | grep -vE '^packages/' || true)
if [ -n "$rootfiles" ]; then
  # shellcheck disable=SC2086
  run_eslint "." $rootfiles
fi

echo "==> re-staging fixed files"
echo "$files" | xargs git add

if [ "$fail" = 1 ]; then
  echo
  echo "eslint가 자동 수정하지 못한 에러가 남음 — 위 메시지를 보고 수동 수정 후 다시 시도" >&2
  exit 1
fi

echo
echo "OK — 이제 commit 가능"
