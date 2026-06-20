// 배포 도메인. dev 는 localhost, 그 외엔 커스텀 도메인. NEXT_PUBLIC_SITE_URL 로 덮어쓸 수 있음.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://cairnlog.cloud');
