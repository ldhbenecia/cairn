#!/usr/bin/env bash
set -euo pipefail

# cairn-daily launchd 등록 헬퍼
#
# - placeholder (__NODE_PATH__ / __CAIRN_DIR__ / __USER_HOME__) 치환
# - ~/Library/LaunchAgents/com.user.cairn-daily.plist 에 배치
# - launchctl bootstrap (또는 bootout 후 재등록)
#
# 사용:
#   ops/install.sh            # plist 등록
#   ops/install.sh --uninstall # plist 해제
#
# 검증:
#   launchctl list | grep cairn   # 등록 확인
#   tail -f ~/.cairn/logs/launchd.out.log
#   tail -f ~/.cairn/logs/cairn-$(date +%Y-%m-%d).log
#
# plist 의 시간 (StartCalendarInterval) 은 시스템 TZ 기준. macOS 가 KST 면 19:00 + 23:00 KST.

LABEL="com.user.cairn-daily"
PLIST_DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
TARGET="gui/$UID/$LABEL"

uninstall() {
  if launchctl print "$TARGET" >/dev/null 2>&1; then
    launchctl bootout "gui/$UID" "$PLIST_DEST" 2>/dev/null || true
  fi
  rm -f "$PLIST_DEST"
  echo "✓ cairn-daily uninstalled."
}

if [[ "${1:-}" == "--uninstall" ]]; then
  uninstall
  exit 0
fi

CAIRN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_PATH="$(command -v node || true)"
USER_HOME="$HOME"
TEMPLATE="$CAIRN_DIR/ops/com.user.cairn-daily.plist.template"

if [[ -z "$NODE_PATH" ]]; then
  echo "✗ node not found in PATH. install Node 24 LTS first." >&2
  exit 1
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "✗ template not found: $TEMPLATE" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/.cairn/logs"

# 기존 등록되어 있으면 먼저 해제
if launchctl print "$TARGET" >/dev/null 2>&1; then
  launchctl bootout "gui/$UID" "$PLIST_DEST" 2>/dev/null || true
fi

sed \
  -e "s|__NODE_PATH__|$NODE_PATH|g" \
  -e "s|__CAIRN_DIR__|$CAIRN_DIR|g" \
  -e "s|__USER_HOME__|$USER_HOME|g" \
  "$TEMPLATE" > "$PLIST_DEST"

launchctl bootstrap "gui/$UID" "$PLIST_DEST"

echo "✓ cairn-daily installed: $PLIST_DEST"
echo "  scheduled: 19:00 + 23:00 (system TZ)"
echo "  node: $NODE_PATH"
echo "  cwd:  $CAIRN_DIR"
echo "  logs: $USER_HOME/.cairn/logs/"
echo ""
echo "verify:"
echo "  launchctl print $TARGET | head -20"
echo ""
echo "uninstall:"
echo "  ops/install.sh --uninstall"
