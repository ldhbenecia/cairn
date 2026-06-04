# 2026-06-04 — release-prep

> 진행 단계: **배포 + 자동 업데이트** (시작)
> 상태: 진행 중
> 플랜: [docs/plans/2026-06-04-release-auto-update.md](../plans/2026-06-04-release-auto-update.md)

## 완료
### PR1 — 발행 페이지 정리 (i18n · operator 게이팅 · Claude 아이콘)
- 발행 페이지 고정 문구(콜아웃·페이지 제목·토글 제목)를 출력 언어(lang)에 맞춰 ko/en 분기. 헤딩은 이미 영어라 무변경
- raw 메타 (디버그) 토글을 `isOperator()` 전용으로 — 그동안 모든 사용자 일지에 노출되던 것 차단 (usage 콜아웃은 이미 operator 전용)
- "자동 생성" 배너 아이콘을 공식 Claude 심볼(주황 #da7756, Wikimedia)로 교체 — 레포 호스팅(docs/assets) + Notion external icon

## 진행 중
- (다음) electron-builder dist 설정 + electron-updater(check+notify)

## 시행착오 / 결정
- OpenUsage 는 Tauri라 updater 메커니즘은 못 옮김 — 배포 골격만 참고. cairn 은 electron-updater
- 미서명 → mac 자동 *적용* 불가(Squirrel.Mac 서명 요구) → 0.x 는 check+notify
- 앱 버전 = desktop/package.json (Electron 표준), 태그 v<버전>
- Claude 아이콘 raw URL 은 main 기준 → PR 머지 후 resolve (머지 전엔 아이콘 404)

## 다음
- dist 설정 → updater → release.yml + ci.yml → README 배포 섹션 → 이슈 템플릿 + 피드백→이슈 + repo 링크 → 첫 릴리스
