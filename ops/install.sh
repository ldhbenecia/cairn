#!/usr/bin/env bash
set -euo pipefail

# [DEPRECATED] cairn 자동 발행은 데스크톱 앱이 소유한다 (ADR 0015).
# 앱과 함께 배포·사용하는 게 기본이라 이 launchd 경로는 더 이상 권장하지 않는다.
# 엔진만 헤드리스로 돌리는 레거시/특수 케이스용으로만 남겨둠.
# 이미 등록돼 있다면 앱의 자동 발행과 중복되지만, publisher 의 already-published
# precheck 로 중복 발행은 무해(크레딧 낭비 없음). 정리하려면 `ops/install.sh --uninstall`.

# cairn launchd 등록 헬퍼 (daily / weekly / monthly 일괄)
#
# - 각 plist template 의 placeholder (__NODE_PATH__ / __CAIRN_DIR__ /
#   __USER_HOME__) 치환
# - ~/Library/LaunchAgents/com.user.cairn-{daily,weekly,monthly}.plist 에 배치
# - launchctl bootstrap (또는 bootout 후 재등록)
#
# 사용:
#   ops/install.sh                # launchd 3개 등록
#   ops/install.sh --with-wake    # launchd 3개 + pmset wake (02:55) opt-in
#   ops/install.sh --uninstall    # launchd 3개 해제 (+ cairn 이 박은 pmset 해제)
#
# RunAtLoad: true 라 등록 직후 / 사용자 로그인마다 1회 발화 →
# cairn 의 backfill 이 빠진 날짜를 자동 채움. sleep 중 missed 슬롯도
# 다음 로그인 / 깨움 시 catch up.
#
# --with-wake (opt-in):
#   sudo pmset repeat wakeorpoweron MTWRFSU 02:55:00 등록 → Mac 이 매일
#   02:55 sleep 에서 깸 → 03:00 의 launchd 슬롯 대신 daily 의 RunAtLoad
#   기반 catch up. 안 박아도 RunAtLoad + backfill 로 일상 대부분 cover 됨.
#
# 검증:
#   launchctl list | grep cairn
#   pmset -g sched
#   tail -f ~/.cairn/logs/launchd.out.log              # daily
#   tail -f ~/.cairn/logs/launchd-weekly.out.log
#   tail -f ~/.cairn/logs/launchd-monthly.out.log
#   tail -f ~/.cairn/logs/cairn-$(date +%Y-%m-%d).log

KINDS=(daily weekly monthly)
PMSET_SENTINEL="$HOME/.cairn/pmset-installed-by-cairn"
PMSET_WAKE_TIME="02:55:00"
PMSET_WAKE_DAYS="MTWRFSU"

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

uninstall_pmset_if_ours() {
  if [[ -f "$PMSET_SENTINEL" ]]; then
    echo "→ cairn 이 박은 pmset wake 스케줄 해제 (sudo 필요)"
    sudo pmset repeat cancel
    rm -f "$PMSET_SENTINEL"
    echo "✓ pmset repeat 해제."
  fi
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

install_pmset_wake() {
  echo ""
  echo "→ pmset wake 스케줄 등록 (sudo 필요)"
  echo "  매일 $PMSET_WAKE_TIME 에 Mac 을 sleep 에서 깨움 → launchd 03:00 슬롯 발화."
  echo "  pmset repeat 는 시스템 전역 1 슬롯이라 다른 도구의 wake 스케줄을 덮어씁니다."
  read -r -p "  계속? [y/N] " ans
  if [[ "$ans" != "y" && "$ans" != "Y" ]]; then
    echo "  → pmset 셋팅 skip."
    return
  fi
  sudo pmset repeat wakeorpoweron "$PMSET_WAKE_DAYS" "$PMSET_WAKE_TIME"
  mkdir -p "$(dirname "$PMSET_SENTINEL")"
  date +'%Y-%m-%d %H:%M:%S' > "$PMSET_SENTINEL"
  echo "✓ pmset repeat 등록 완료. sentinel: $PMSET_SENTINEL"
}

# 인자 파싱
WITH_WAKE=0
MODE=install
for arg in "$@"; do
  case "$arg" in
    --uninstall) MODE=uninstall ;;
    --with-wake) WITH_WAKE=1 ;;
    *) echo "unknown arg: $arg" >&2; exit 1 ;;
  esac
done

if [[ "$MODE" == "uninstall" ]]; then
  for kind in "${KINDS[@]}"; do
    uninstall_one "com.user.cairn-$kind"
  done
  uninstall_pmset_if_ours
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

if [[ "$WITH_WAKE" -eq 1 ]]; then
  install_pmset_wake
fi

echo ""
echo "  scheduled:"
echo "    daily   매일 19:00 + 23:00 + RunAtLoad (로그인 / 깨움 시)"
echo "    weekly  매주 월요일 07:00 + 11:00 + RunAtLoad"
echo "    monthly 매월 2일 07:00 + 11:00 + RunAtLoad"
echo "  (system TZ — macOS 가 KST 면 KST)"
echo "  node: $NODE_PATH"
echo "  cwd:  $CAIRN_DIR"
echo "  logs: $USER_HOME/.cairn/logs/"
if [[ "$WITH_WAKE" -eq 1 ]] && [[ -f "$PMSET_SENTINEL" ]]; then
  echo "  pmset wake: $PMSET_WAKE_TIME (sentinel $PMSET_SENTINEL)"
fi
echo ""
echo "verify:"
echo "  launchctl print gui/\$UID/com.user.cairn-daily | head -20"
echo "  launchctl print gui/\$UID/com.user.cairn-weekly | head -20"
echo "  launchctl print gui/\$UID/com.user.cairn-monthly | head -20"
echo "  pmset -g sched   # --with-wake 셋팅했으면 wakepoweron 보여야 함"
echo ""
echo "uninstall:"
echo "  ops/install.sh --uninstall   # cairn 이 박은 pmset 도 함께 해제"
