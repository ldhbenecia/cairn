# 0004. NestJS 공식 컨벤션 + standalone application 사용

- 상태: accepted
- 작성일: 2026-04-26

## 맥락

cairn은 백엔드 도구이지만 **HTTP 서버를 띄우지 않는다** (launchd가 매번 새 프로세스로 1회 실행). NestJS는 HTTP 프레임워크로 잘 알려져 있지만, 실은 DI/모듈/lifecycle 같은 인프라가 본체이고 HTTP는 그 위에 얹는 어댑터. 그래서 standalone 모드(`createApplicationContext`)로 HTTP 없이도 충분히 활용 가능.

DI 컨테이너만 필요한 규모이므로 더 가벼운 선택지(tsyringe, awilix 등)도 후보였으나, ConfigModule·라이프사이클 훅·테스트 유틸 등 인프라 모듈 성숙도와 한국 백엔드 생태계 친숙도를 고려하면 NestJS가 합리적.

추가로 명명/구조에 모호함이 있으면 항상 NestJS 공식 문서를 따른다는 원칙을 둔다 (Stack Overflow나 블로그보다 우선).

## 결정

1. **NestJS standalone application** 사용. `NestFactory.createApplicationContext(AppModule)`. HTTP 모듈/Controller 사용 X.
2. **명명·구조 컨벤션은 NestJS 공식 docs 따름** (https://docs.nestjs.com).
   - 파일: kebab-case + 타입 suffix (`users.service.ts`, `create-user.dto.ts`)
   - 클래스: PascalCase + 타입 suffix (`UsersService`, `CreateUserDto`)
   - 디렉토리: 리소스/도메인은 복수형, 외부 시스템 어댑터·단일 책임은 단수
3. **deprecated API 사용 금지**. 라이브러리/프레임워크의 deprecated 표시는 작성 시점에 감지해서 권장 대안으로 교체.

## 대안

- **A. NestJS 안 쓰고 그냥 TypeScript 클래스 + commander** — 가장 가벼움. 단 모듈 구조가 ad-hoc해지고 collector·publisher가 늘어나면 wiring 비용이 빠르게 증가.
- **B. NestJS HTTP 모드 + 셀프 호출** — 항상 떠있는 프로세스가 cron 같은 역할. 단 launchd가 멱등성·비용·복잡도 면에서 더 깔끔.
- **C. tsyringe / awilix 등 가벼운 DI 컨테이너** — DI만 쓸 거면 NestJS는 분명 과함. 단 ConfigModule·라이프사이클·테스트 유틸 등 무료로 따라오는 인프라가 적어 직접 만들 부분이 늘어남.

## 결과

- **장점**: DI/모듈 구조 깔끔, 사용자 친숙, 잘 만들어진 인프라(ConfigModule, Logger 등) 활용
- **트레이드오프**: HTTP 안 쓰는데 NestJS는 무거움 (~수십 MB). 그러나 launchd가 매번 부팅하는 프로세스라 메모리 영구 점유 X
- **표면화**: `src/main.ts`에서 명시적으로 `createApplicationContext` 사용. PR 리뷰 시 `app.listen` 호출이 발견되면 즉시 거부

## 관련

- 명명 규칙 상세: `.claude/rules/nestjs-conventions.md`
- 모듈 구조: `docs/plans/2026-04-26-cairn-overall.md` "NestJS 모듈" 섹션
- deprecated API 회피 룰: feedback memory `feedback_no_deprecated_apis.md` (사용자 합의)
