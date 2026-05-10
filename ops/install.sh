#!/usr/bin/env bash
set -euo pipefail

# cairn launchd 등록 헬퍼 (daily / weekly / monthly 일괄)
#
# - 각 plist template 의 placeholder (__NODE_PATH__ / __CAIRN_DIR__ /
#   __USER_HOME__) 치환
# - ~/Library/LaunchAgents/com.user.cairn-{daily,weekly,monthly}.plist 에 배치
# - launchctl bootstrap (또는 bootout 후 재등록)
#
# 사용:
#   ops/install.sh             # 세 plist 모두 등록
#   ops/install.sh --uninstall # 세 plist 모두 해제
#
# 검증:
#   launchctl list | grep cairn
#   tail -f ~/.cairn/logs/launchd.out.log              # daily
#   tail -f ~/.cairn/logs/launchd-weekly.out.log
#   tail -f ~/.cairn/logs/launchd-monthly.out.log
#   tail -f ~/.cairn/logs/cairn-$(date +%Y-%m-%d).log
#
# plist 의 시간 (StartCalendarInterval) 은 시스템 TZ 기준. macOS 가 KST 일 때:
#   - daily   매일 19:00 + 23:00
#   - weekly  매주 월요일 07:00 + 11:00
#   - monthly 매월 2일 07:00 + 11:00

KINDS=(daily weekly monthly)

uninstall_one() {
  local label="$1"
  local plist_dest="$HOME/Library/LaunchAgents/$label.plist"
  local target="gui/$UID/$label"

  if launchctl print "$target" >/dev/null 2>&1; then
    launchctl bootout "gui/$UID" "$plist_dest" 2>/dev/null || true
  fi
  rm -f "$plist_dest"
  echo "✓ $label uninstalled."
}

install_one() {
  local kind="$1"
  local label="com.user.cairn-$kind"
  local template="$CAIRN_DIR/ops/$label.plist.template"
  local plist_dest="$HOME/Library/LaunchAgents/$label.plist"
  local target="gui/$UID/$label"

  if [[ ! -f "$template" ]]; then
    echo "✗ template not found: $template" >&2
    exit 1
  fi

  if launchctl print "$target" >/dev/null 2>&1; then
    launchctl bootout "gui/$UID" "$plist_dest" 2>/dev/null || true
  fi

  sed \
    -e "s|__NODE_PATH__|$NODE_PATH|g" \
    -e "s|__CAIRN_DIR__|$CAIRN_DIR|g" \
    -e "s|__USER_HOME__|$USER_HOME|g" \
    "$template" > "$plist_dest"

  launchctl bootstrap "gui/$UID" "$plist_dest"
  echo "✓ $label installed: $plist_dest"
}

if [[ "${1:-}" == "--uninstall" ]]; then
  for kind in "${KINDS[@]}"; do
    uninstall_one "com.user.cairn-$kind"
  done
  exit 0
fi

CAIRN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_PATH="$(command -v node || true)"
USER_HOME="$HOME"

if [[ -z "$NODE_PATH" ]]; then
  echo "✗ node not found in PATH. install Node 24 LTS first." >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/.cairn/logs"

for kind in "${KINDS[@]}"; do
  install_one "$kind"
done

echo ""
echo "  scheduled:"
echo "    daily   매일 19:00 + 23:00"
echo "    weekly  매주 월요일 07:00 + 11:00"
echo "    monthly 매월 2일 07:00 + 11:00"
echo "  (system TZ — macOS 가 KST 면 KST)"
echo "  node: $NODE_PATH"
echo "  cwd:  $CAIRN_DIR"
echo "  logs: $USER_HOME/.cairn/logs/"
echo ""
echo "verify:"
echo "  launchctl print gui/\$UID/com.user.cairn-daily | head -20"
echo "  launchctl print gui/\$UID/com.user.cairn-weekly | head -20"
echo "  launchctl print gui/\$UID/com.user.cairn-monthly | head -20"
echo ""
echo "uninstall:"
echo "  ops/install.sh --uninstall"
