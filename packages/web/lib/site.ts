// 배포 도메인. 커스텀 도메인은 NEXT_PUBLIC_SITE_URL 로 덮어쓰고,
// Vercel 프리뷰/프로덕션은 자동 주입되는 도메인을 쓴다. 로컬은 localhost.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');
