# 0025. 로컬 내보내기(MD/PDF) + Obsidian 자동 동기화 아키텍처

- 상태: accepted
- 작성일: 2026-06-15

## 맥락

Notion 은 토큰만 등록하면 자동 발행되지만 그 외 출력 경로가 없어 강제적이었다. 사용자는 Markdown 파일·PDF·Obsidian 연동·네이티브 메모 같은 대안 출력을 원했다. Obsidian vault 는 사실상 `.md` 파일 폴더이므로 "로컬 Markdown 출력"이 공통 기반이 된다.

## 결정

- **변환기 공유화**: 일지 블록(`SimpleBlock`) → Markdown 변환기를 `src/shared/markdown.ts` 로 두어 renderer(드로어 복사·저장)와 main(발행 시 자동 동기화)이 공유. cairn-api 의존 없는 구조적 타입(`MdBlock`). `tsconfig.node/web` include 에 `src/shared` 추가. PDF 용 `src/shared/html.ts`(블록→인라인 CSS HTML)도 동일.
- **단발 내보내기**(드로어): "MD 복사"(클립보드) / ".md 저장"(저장 다이얼로그) / "PDF 저장". PDF 는 main 오프스크린 `BrowserWindow` 에 HTML 을 data URL 로 싣고 `webContents.printToPDF`.
- **발행 시 자동 동기화**: `settings.export { folder, autoSync }`. core-runner 의 발행 **성공 지점**에서 `fetchPageContent → 변환 → folder 에 YYYY-MM-DD.md` 기록. 수동·스케줄 발행 양쪽이 이 경로를 탄다. 로컬 날짜 기준(타임존 규칙). 실패는 발행을 막지 않음(fire-and-forget). folder 를 Obsidian vault 로 가리키면 곧 Obsidian 연동.

## 대안

- **renderer 에서만 자동 동기화**: 변환기는 renderer 에 있으니 단순하지만, 스케줄 자동 발행(메인 단독)이 커버 안 됨 → main 단일 choke point 로 결정(변환기 shared 분리 비용 감수).
- **Notion 대체(폴더 전용 출력)**: 출력 대상 택1 까지는 1차 범위 밖. Notion 과 병행하는 자동 동기화로 시작.
- **Obsidian 플러그인 수준 연동**: 과함. vault 폴더 출력으로 충분.

## 결과

- Notion 강제성 완화 — MD/PDF/Obsidian 3종 출력 경로 확보.
- 변환기가 main/renderer 공유라 단발·자동 동기화·PDF 가 같은 표현을 낸다.
- 구현: PR #148(MD 복사·저장), #149(Obsidian 자동 동기화 + 변환기 shared 분리), #150(PDF).
