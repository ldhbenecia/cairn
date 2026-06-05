# 2026-06-04 — preferences-polish

> 상태: 완료 (PR #56)

## 완료
- 피드백 탭에 "GitHub 이슈로 등록" 버튼 추가(기존 메일 병행). `issues/new` 에 본문+버전 prefill
- About: GitHub 레포 카드(아이콘+레포명+설명+**라이브 Star 수**). Star 는 main 의 `cairn:repo:stars` IPC(GitHub API). 배지 hover 시 노란 별. 클릭 시 레포 열기
- 앱 버전을 About 본문 → 사이드바 하단으로 작게
- 탭 전환 `panel-enter` 애니메이션(key=tab 리마운트)
- 클릭 요소 pointer 커서 제거(전역 button + 토글·리스트 행·드로워) → 데스크톱 네이티브 화살표

## 시행착오 / 결정
- preload IPC 추가는 dev HMR 로 안 잡혀서 About 첫 렌더가 크래시(까만 화면) → `repoStars?.()` 가드 + "dev 풀 재시작 필요" 인지
- **버전 정책 정리(ADR 0018)**: core/desktop 은 모듈별 버전, root(워크스페이스)는 PR 마다 +1 인 통합 버전. **앱 About 표시 버전을 desktop(0.3.x) → root(워크스페이스)** 로 변경 — `electron.vite.config` 가 root version 을 `__WORKSPACE_VERSION__` 으로 빌드 주입(패키징 앱엔 root pkg 없으므로). 이번 PR: desktop 0.3.1 + root 0.17.1→0.17.2
- 별 hover 색 등 미세 인터랙션은 렌더 화면 보며 조정

## 다음
- (배포 본작업, 다음 세션) electron-builder dist + electron-updater(check+notify) → 첫 릴리스 v0.3.x