# 리뷰 체크리스트

## 외부 송신 보안 ([security-egress.md](../../../rules/security-egress.md))

- 외부 sink로 나가는 페이로드에 코드 본문/diff/절대경로/토큰/이메일이 없나?
- 새 외부 송신 경로에 fail-closed `assertNoForbiddenPayload`가 적용됐나? (디버그/오퍼레이터 덤프 포함)
- 송신 타입 정의 자체에 코드/diff 필드를 두지 않았나?

## 타임존 ([timezone.md](../../../rules/timezone.md))

- 날짜/시간 로직이 KST·UTC를 단정하지 않고 머신 로컬 TZ를 따르나?
- 날짜 윈도우는 `localDateToUtcWindow`/`todayLocalIsoDate`를 쓰나? (`setUTCHours`·`+9` 금지)

## 기능 검증

- 의도한 기능이 정확히 구현됐나?
- 예외 케이스가 처리됐나? (빈 배열, null, undefined, 데이터 없음)
- 비즈니스 로직이 요구사항과 일치하나?

## 성능 및 동시성

- 불필요한 순차 처리가 없나? (`Promise.all` 가능 여부)
- 외부 API 호출에 throttling/retry가 적용됐나?
- 비효율적인 동작은 없나?

## 구조·코드 품질 ([nestjs-conventions.md](../../../rules/nestjs-conventions.md))

- `index.ts` barrel을 새로 만들지 않았나? import가 구체 파일 경로인가?
- 파일명·클래스명이 kebab-case + 타입 suffix / PascalCase 컨벤션을 따르나?
- 중복 로직이 util/helper로 분리됐나? 매직 넘버가 상수로 정의됐나?
- 함수가 단일 책임 원칙을 따르나?

## 코드 직관성 및 가독성

- 코드 자체만으로 의도가 드러나나? 처음 보는 사람이 맥락 추적 없이 이해 가능한가?
- 과도한 중첩/조건문은 없나?
- 주석이 정말 필요한 것만인가? (메타/내레이션 주석 금지)

## 프로세스 ([git-conventions.md](../../../rules/git-conventions.md))

- PR 제목이 Conventional Commits 형식(`type(scope): 한국어 주제`)인가?
- PR Body가 템플릿(요약/작업사항/체크리스트)을 따르고 변경 의도·범위를 명확히 설명하나?
- 커밋이 의미 단위로 잘게 나뉘었나? (한 PR = 한 커밋 금지)
- 버전 bump가 ADR 0020 기준인가? (patch 기본, 체감 기능 묶음당 minor 1회)
- 비자명한 결정에 ADR이 있고, 진행 일지가 갱신됐나?
