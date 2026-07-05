const FALLBACK: Record<string, string> = {
  sonnet: 'opus',
  haiku: 'sonnet',
  opus: 'sonnet',
};

export function summaryModelOption(): { model?: string; fallbackModel?: string } {
  const v = process.env.CAIRN_SUMMARY_MODEL?.trim().toLowerCase();
  if (!v || !(v in FALLBACK)) return {};
  return { model: v, fallbackModel: FALLBACK[v] };
}

const FAMILIES = ['sonnet', 'opus', 'haiku'];

// 발행물 표기 라벨 — 실제 모델 id 면 버전 포함('claude-opus-4-8*' → 'Claude Opus 4.8'),
// 설정 별칭 폴백이면 버전 없이('Claude Opus') — 별칭은 실행 시점 최신으로 해석되므로 버전을 단정하지 않는다
export function summaryModelLabel(model?: string): string {
  const title = (f: string): string => `Claude ${f.charAt(0).toUpperCase()}${f.slice(1)}`;
  const id = model?.trim().toLowerCase();
  if (id) {
    const family = FAMILIES.find((f) => id.includes(f));
    if (!family) return 'Claude';
    const version = versionFromModelId(id, family);
    return version ? `${title(family)} ${version}` : title(family);
  }
  const alias = summaryModelOption().model;
  return alias ? title(alias) : 'Claude';
}

// id 의 숫자 세그먼트를 버전으로 — 'claude-opus-4-8-20260101' → '4.8'. 4자리 이상은 날짜 스냅샷이라 제외
function versionFromModelId(id: string, family: string): string {
  const parts = id.split('-');
  const i = parts.indexOf(family);
  if (i < 0) return '';
  const nums = (seg: string[]): string[] => {
    const out: string[] = [];
    for (const p of seg) {
      if (!/^\d{1,3}$/.test(p)) break;
      out.push(p);
    }
    return out;
  };
  const after = nums(parts.slice(i + 1));
  // 구형 id('claude-3-5-sonnet-*')는 버전이 family 앞에 온다
  return (after.length > 0 ? after : nums(parts.slice(1, i))).join('.');
}
