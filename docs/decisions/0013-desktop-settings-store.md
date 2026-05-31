# 0013. 데스크탑 사용자 설정 저장소 — ~/.cairn/settings.json (main 소유)

- 상태: accepted
- 작성일: 2026-05-31

## 맥락

v0.17 에서 테마(다크/라이트)·언어(ko/en)·알림 on/off·커스텀 프롬프트 같은 **사용자 환경설정**이 필요해졌다. 이들은 관심사가 프로세스별로 갈린다:

- 테마·언어 → 렌더러
- 알림 → main (notifier)
- 커스텀 프롬프트 → core (엔진, 별도 fork 프로세스)

즉 **3개 프로세스가 공유**해야 한다. 또 데스크탑 preload 는 `sandbox: true` 라 node fs 를 못 쓴다(무플래시 초기 로드 문제).

## 결정

- 사용자 설정은 **`~/.cairn/settings.json`** 단일 파일에 저장한다.
- **main 이 소유**(read/write). `src/main/settings.ts` 의 `readSettings()` / `writeSettings(patch)`.
- 렌더러는 IPC 로 접근: `cairn:settings:set`(async). 변경 결과 머지된 Settings 반환.
- **무플래시 초기 로드**: preload 가 `ipcRenderer.sendSync('cairn:bootstrap-sync')` 로 main 에서 `{ settings, version }` 을 동기 수신 → `window.cairn.initialSettings` 로 노출. 렌더러는 첫 페인트 전에 테마 적용.
- core 는 실행 시 이 파일을 직접 읽어 customPrompt override (PR-3).
- 엔진 데이터 config(`worklog.config.json`)와는 **분리**. 그건 수집/발행 대상 정의, 이건 앱 UX 환경설정.

스키마:
```jsonc
{ "theme": "dark|light|system", "language": "ko|en", "notifications": true,
  "prompts": { "daily": null, "weekly": null, "monthly": null } }  // null = 기본
```

## 대안

- **localStorage(렌더러 전용)**: main/core 가 못 읽음 → 알림·프롬프트 공유 불가. 기각.
- **worklog.config.json 확장**: 엔진 데이터 config 와 사용자 UX 설정이 뒤섞임. 관심사 분리 위배. 기각.
- **electron-store 의존 추가**: 작은 JSON 하나에 의존성 과함. 직접 fs 로 충분. 기각.

## 결과

- preload 가 sandbox 라도 sendSync 로 무플래시 달성. 단 main 이 `cairn:bootstrap-sync` 핸들러를 createWindow 전에 등록해야 함(순서 의존).
- 설정 추가 시 settings.ts 의 DEFAULTS + 타입(main/preload/cairn-api.d.ts 3곳)만 맞추면 됨.
- 향후 설정 마이그레이션 필요 시 readSettings 에서 버전 필드로 처리.
