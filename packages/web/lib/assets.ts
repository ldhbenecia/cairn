// 영상은 Supabase Storage(public 버킷 `assets`)에서 호출 — 앱·repo 번들 대신 호스팅해 화질·용량 분리
const ASSETS =
  process.env.NEXT_PUBLIC_ASSETS_URL ??
  'https://kibhguaxqtibmujhdjif.supabase.co/storage/v1/object/public/assets';

export const VIDEO = {
  intro: `${ASSETS}/intro.mp4`,
  notionIntegration: `${ASSETS}/notion-integration.mp4`,
};
