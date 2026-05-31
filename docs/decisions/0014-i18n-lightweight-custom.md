# 0014. 데스크탑 i18n — 경량 커스텀 (의존성 X)

- 상태: accepted
- 작성일: 2026-05-31

## 맥락

데스크탑 앱에 한국어/영어 전환이 필요해졌다(v0.17 #1/#2). 앱 규모가 작고 언어가 2개뿐이다.

## 결정

**경량 커스텀 i18n** 채택 — 외부 라이브러리 없이:

- `src/renderer/src/i18n.ts`: `STRINGS = { ko: {...}, en: {...} } as const`, `type I18nKey`, `translate(lang, key)`.
- 언어는 설정([[0013-desktop-settings-store]])에서. `SettingsProvider` 가 `t(key) = translate(settings.language, key)` 제공 → `useSettings().t`.
- 누락 키는 ko fallback. 키는 `as const` 라 타입 안전(오타 컴파일 에러).
- 기본 ko.

## 대안

- **react-i18next / i18next**: 복수형·보간·네임스페이스·로딩 등 강력하지만 2개 언어 정적 앱엔 과함(번들·러닝코스트). 기각.
- **react-intl(FormatJS)**: 메시지 추출 툴체인 무거움. 기각.

## 결과

- 의존성 0, 타입 안전, 번들 가벼움.
- 한계: 복수형/보간 기본 미지원 — 필요해지면 `t(key, params)` 정도만 확장하거나 그 시점에 라이브러리 재검토(새 ADR).
- 문자열 추가 시 ko/en 양쪽 키를 채워야 함(누락 시 ko fallback 으로 조용히 넘어가니 리뷰 주의).
- 발행물(노션 일지) 본문 언어는 별개 — 이건 UI 언어만. 일지 언어는 프롬프트/요약기 영역.
