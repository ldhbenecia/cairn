# 2026-06-04 — run-error-surface

> 상태: 완료

## 완료
- 발행 트리거(`App.tsx`)에 `catch` 가 없어, core 실행이 reject(예: "이미 다른 작업이 실행 중입니다")되면 세션이 `running` 인 채로 남아 모달이 "준비하는 중…" 에 영영 멈추던 버그 수정
- `trigger` 의 catch 에서 세션을 `done` + `error` 로 전환, 발행 모달에 ErrorCard 표시(닫기 버튼). `RunSession.error` 필드 추가
- i18n `publish.result.error` 추가 (ko/en)

## 시행착오 / 결정
- 충돌 자체(첫 실행 시 백그라운드 작업이 `running` 점유 중 수동 트리거)는 별도 — 우선 에러를 UI 로 surface. 백그라운드 실행 인지(트리거 비활성화/대기)는 후속 가능
- 에러 detail 은 main 프로세스의 친화 메시지 그대로 표시(엔진 raw 로그 아님)

## 다음
- (선택) `cairn:running` 기반으로 백그라운드 실행 중엔 트리거 비활성화 + 안내
