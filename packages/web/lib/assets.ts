const ASSETS =
  process.env.NEXT_PUBLIC_ASSETS_URL ??
  'https://kibhguaxqtibmujhdjif.supabase.co/storage/v1/object/public/assets';

export const VIDEO = {
  intro: `${ASSETS}/intro.mp4`,
  notionIntegration: `${ASSETS}/notion-integration.mp4`,
};
