export const pad2 = (n: number): string => String(n).padStart(2, '0');

// Date 의 로컬 날짜(YYYY-MM-DD) — 로컬 getter 기준, KST·UTC 단정 금지
export function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
