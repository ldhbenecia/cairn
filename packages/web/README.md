# @cairn/web

cairn 홍보 랜딩 사이트. **데스크톱 앱과 독립** — 자체 버전/태그/릴리스를 따르지 않고, Vercel 이 `main` 푸시 시 자동 배포한다.

## 스택

- Next.js (App Router) + React + Tailwind v4
- GitHub 스타 수·최신 릴리스는 서버 컴포넌트에서 1시간 ISR 로 가져옴 (`lib/github.ts`)

## 로컬

```bash
pnpm --filter @cairn/web dev     # http://localhost:3000
pnpm --filter @cairn/web build   # 프로덕션 빌드
```

## Vercel 배포 (최초 1회 설정)

1. [vercel.com](https://vercel.com) → **Add New → Project** → cairn 레포 import
2. **Root Directory** 를 `packages/web` 로 지정 (Framework: Next.js 자동 감지)
3. Install Command 는 모노레포 루트에서 자동 (`pnpm install`), Build 는 `next build`
4. Deploy. 이후 `main` 에 web 변경이 푸시되면 자동 재배포

> 토큰·시크릿 불필요(공개 GitHub API 만 사용). 커스텀 도메인은 Vercel 대시보드에서.

## 앱과의 분리

- root `eslint.config.mjs` 에서 `packages/web/**` 제외 (Next 자체 lint 사용)
- web 은 `package.json` 에 `typecheck` 스크립트가 없어 root `pnpm -r typecheck` 에서 자동 제외
- 버전 bump·git 태그·릴리스 워크플로 대상 아님
