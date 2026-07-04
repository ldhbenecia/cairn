import type { DateStep, RunLine } from '../cairn-api';
import type { I18nKey } from '../i18n';

export type T = (key: I18nKey) => string;

// raw 로그는 UI 에 노출하지 않고, 수집 중인 소스 판단에만 내부 사용
export function collectHintKey(lines: RunLine[]): I18nKey {
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]?.line.toLowerCase();
    if (!t) continue;
    if (t.includes('github')) return 'publish.hint.collectGithub';
    if (t.includes('local-git')) return 'publish.hint.collectGit';
  }
  return 'publish.hint.collect';
}

export function collectedCounts(lines: RunLine[]): { pr: number | null; commit: number | null } {
  let pr: number | null = null;
  let commit: number | null = null;
  for (const l of lines) {
    const mPr = /prCount["':\s]+(\d+)/.exec(l.line);
    if (mPr) pr = Number(mPr[1]);
    const mCommit = /commitCountTotal["':\s]+(\d+)/.exec(l.line);
    if (mCommit) commit = Number(mCommit[1]);
  }
  return { pr, commit };
}

// rollup(주간/월간) 이 묶는 daily 일지 날짜들 — core 의 'rollup dailies' 로그에서 파싱
export function parseRollupDailies(lines: RunLine[]): string[] {
  for (const l of lines) {
    if (!/rollup dailies/.test(l.line)) continue;
    const m = /"dailyDates"\s*:\s*\[([^\]]*)\]/.exec(l.line);
    const dates = m?.[1]?.match(/\d{4}-\d{2}-\d{2}/g);
    if (dates?.length) return [...dates].sort();
  }
  return [];
}

const STEP_SEQ: DateStep[] = ['collect', 'summarize', 'publish'];

export type DStatus = 'done' | 'active' | 'pending';

export type PanelDate = {
  date: string;
  dow: string;
  status: DStatus;
  sub: DateStep | null;
  steps: { step: DateStep; status: DStatus }[];
  counts?: { pr: number; commit: number };
};

function weekdayLabel(date: string, lang: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'short',
  });
}

export function buildPanelDates(
  dates: string[],
  doneDates: string[],
  stepByDate: Record<string, DateStep>,
  countsByDate: Record<string, { pr: number; commit: number }>,
  lang: string,
): PanelDate[] {
  // 멤버십 기반 — 동시 완료 순서가 날짜 순서와 달라도 정확(인덱스 가정 제거)
  const doneSet = new Set(doneDates);
  return dates.map((date) => {
    const status: DStatus = doneSet.has(date) ? 'done' : stepByDate[date] ? 'active' : 'pending';
    const sub = status === 'active' ? (stepByDate[date] ?? 'collect') : null;
    const subIdx = sub ? STEP_SEQ.indexOf(sub) : -1;
    const steps = STEP_SEQ.map((step, j) => {
      const sStatus: DStatus =
        status === 'done'
          ? 'done'
          : status === 'pending'
            ? 'pending'
            : j < subIdx
              ? 'done'
              : j === subIdx
                ? 'active'
                : 'pending';
      return { step, status: sStatus };
    });
    return { date, dow: weekdayLabel(date, lang), status, sub, steps, counts: countsByDate[date] };
  });
}
