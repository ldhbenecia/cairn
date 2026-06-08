# 0019. 번들 Claude Code 바이너리 제거 — 시스템 설치본 사용

- 상태: accepted
- 작성일: 2026-06-08

## 맥락

데스크톱 앱(arm64 dmg)이 555MB로, Electron만 쓰는 Discord(464MB)보다 컸다. 원인을 뜯어보니:

```
Electron 프레임워크   231M   (기본값)
claude CLI 바이너리   210M   (@anthropic-ai/claude-agent-sdk-darwin-arm64/claude 단일 Mach-O)
app.asar              97M
```

Claude Agent SDK(ADR 0001)는 요약 시 내부적으로 Claude Code 실행파일을 spawn한다. SDK는 플랫폼별 바이너리(`@anthropic-ai/claude-agent-sdk-darwin-arm64`)를 optionalDependency로 가지며, electron-builder가 이를 prod node_modules로 자동 포함해 **210MB를 통째로 번들**하고 있었다.

OpenUsage 등 다른 Claude 연동 도구는 사용자 로컬에 설치된 Claude Code를 확인해 쓴다. 우리만 무거운 바이너리를 대리 다운로드해 끼워 넣는 것은 합리적이지 않다. 또한 이 번들 바이너리가 packaged 환경에서 실행되지 못해 요약이 fallback으로 빠지는 정황도 있었다.

## 결정

**번들 바이너리를 제거하고, 사용자가 로컬에 설치한 Claude Code(`claude`)를 사용한다.**

- electron-builder 패키징에서 `@anthropic-ai/claude-agent-sdk-darwin-arm64`(플랫폼 바이너리)를 제외 (SDK JS는 core/bundle에 ncc로 인라인되어 있어 무관).
- core가 SDK `query()` 호출 시 `pathToClaudeCodeExecutable` 로 시스템 `claude` 경로를 명시한다 ("Uses the built-in executable if not specified" → 명시 안 하면 이제 없는 built-in을 찾아 실패).
- packaged GUI 앱의 `process.env.PATH` 는 로그인 셸 PATH가 아니라 launchd 최소 PATH라 `claude` 를 그냥은 못 찾는다. 따라서 **로그인 셸 PATH + 알려진 설치 위치**(`/opt/homebrew/bin`, `/usr/local/bin`, `~/.claude/local`, npm global 등)에서 `claude` 를 해석해 core fork에 `CAIRN_CLAUDE_PATH` + 증강 PATH로 전달한다.
- 온보딩 "Claude" 단계: `claude` 미발견 시 설치 안내를 노출한다. 첫 실행 시 설치를 요구할 수 있다.

## 대안

- **바이너리 계속 번들**: 사용자 편의(설치 불필요)는 좋으나 210MB 고정 비용 + packaged 실행 불안정. 기각.
- **API key만으로 동작**: Agent SDK는 API key가 있어도 claude **실행파일**을 spawn한다. 바이너리 없이는 불가. 기각.
- **자체 다운로더로 첫 실행 시 claude 내려받기**: 복잡도·신뢰·업데이트 부담. 시스템 설치본 사용이 단순.

## 결과

- 앱 크기 ~555MB → ~330MB (≈210MB 절감).
- **사용자 요구사항 추가**: Claude Code CLI 설치가 필수가 된다(이전엔 API key만으로도 가능했음). 온보딩에서 안내.
- packaged GUI PATH 문제로 claude 경로 해석이 핵심 — 해석 실패 시 요약이 안 되므로 견고한 다중 위치 탐색 + 명시 전달이 필요.
- dev 환경에선 번들 바이너리가 그대로 있어(빌드에서만 제외) `CAIRN_CLAUDE_PATH` 미설정 시 built-in으로 폴백.
