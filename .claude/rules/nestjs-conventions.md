# NestJS 컨벤션

- 명명·구조가 모호하면 https://docs.nestjs.com 공식 예시를 먼저 따른다
- barrel `index.ts` (re-export) 를 만들지 않는다. import 는 구체 파일 경로 (`./foo/foo.service.js`) — 순환 의존 회피, `nest generate` 도 barrel 을 만들지 않음
