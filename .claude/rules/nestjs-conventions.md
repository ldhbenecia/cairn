# NestJS 명명 / 구조 컨벤션

## 우선순위

명명·구조에 모호함이 있으면 https://docs.nestjs.com 의 공식 예시를 가장 먼저 참조. Stack Overflow나 블로그보다 우선.

## 파일명

kebab-case + 타입 suffix.

| 종류 | 파일명 예 |
|------|----------|
| Controller | `users.controller.ts` |
| Service | `users.service.ts` |
| Module | `users.module.ts` |
| DTO | `create-user.dto.ts` |
| Entity | `user.entity.ts` |
| Interface | `user-repository.interface.ts` |
| Guard / Pipe / Filter / Interceptor | `auth.guard.ts`, `validation.pipe.ts` |

## 클래스명

PascalCase + 타입 suffix.

| 종류 | 클래스명 예 |
|------|------------|
| Controller | `UsersController` |
| Service | `UsersService` |
| Module | `UsersModule` |
| DTO | `CreateUserDto`, `UpdateUserDto` |
| Entity | `User` (단수) |

## 디렉토리

- 리소스/도메인 모듈: **복수형** (`users/`, `posts/`) — RESTful 컨벤션
- 외부 시스템 어댑터·단일 책임 모듈: 시스템 이름 그대로 단수 (`github/`, `notion/`, `summarizer/`)
- 모음/컬렉션 성격: 복수 (`secrets/`, `contracts/`, `tools/`)

## DI

- 생성자 주입 기본
- `@Injectable()` 명시
- 인터페이스는 `src/contracts/` 또는 모듈 내 `*.interface.ts`

## standalone application

- HTTP 서버 없음 → `NestFactory.createApplicationContext`
- HTTP 모듈/Controller 사용 X (Service + Provider 중심)

## 결정이 모호하면

ADR로 기록 후 진행. `.claude/rules/decisions-workflow.md` 참조.
