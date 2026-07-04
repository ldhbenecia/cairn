import { broadcast } from './broadcast';
import type { CoreMode } from './core-runner';

// 백필 배치 진행 — 전체 stdout 스트림 기준 누적(렌더러 200줄 tail 제한에 영향받지 않게)
export type DateStep = 'collect' | 'summarize' | 'publish';
export type DateCounts = { pr: number; commit: number };
export type RunProgress = {
  total: number;
  done: number;
  active: number;
  dates: string[];
  doneDates: string[];
  stepByDate: Record<string, DateStep>;
  countsByDate: Record<string, DateCounts>;
};
let runProgress: RunProgress | null = null;
let bfTotal = 0;
let bfDone = 0;
let bfStarted = 0;
let bfInStat = false;
let bfLastKey = '';
let bfDates: string[] = [];
let bfDoneDates: string[] = [];
let bfStepByDate: Record<string, DateStep> = {};
let bfStepBlock: { date?: string; step?: DateStep } | null = null;
let bfCountsByDate: Record<string, DateCounts> = {};
let bfCountBlock: { date?: string; pr?: number; commit?: number; noActivity?: boolean } | null =
  null;
let bfLastPublishedDate: string | null = null;
let bfPagesByDate: Record<string, string> = {};
let bfPendingPage: { date: string | null; pageId: string | null } | null = null;

// 'daily: publish done' 블록에서 date↔pageId 쌍 추출 — 백필 다건 발행 시 export 가
// 마지막 페이지만 sync 하던 문제의 재료. JSON 한 줄·pino-pretty 멀티라인 모두 대응.
function trackPublishedPage(line: string): void {
  const pidOf = (l: string): string | undefined =>
    /pageId["':\s]+["']?([0-9a-f-]{32,36})/.exec(l)?.[1];
  if (/daily: publish done/.test(line)) {
    const d = /date["':\s]+["']?(\d{4}-\d{2}-\d{2})/.exec(line)?.[1];
    const pid = pidOf(line);
    if (d && pid) {
      bfPagesByDate = { ...bfPagesByDate, [d]: pid };
      bfPendingPage = null;
    } else {
      bfPendingPage = { date: d ?? null, pageId: pid ?? null };
    }
    return;
  }
  if (!bfPendingPage) return;
  // trackDateCounts 와 동일 — 새 블록 헤더가 나오면 pending 폐기 (무관 블록의 date/pageId 오염 방지)
  if (/^\[\d{2}:\d{2}:\d{2}/.test(line) || /"msg"\s*:/.test(line)) {
    bfPendingPage = null;
    return;
  }
  const d = /date["':\s]+["']?(\d{4}-\d{2}-\d{2})/.exec(line)?.[1];
  if (d) bfPendingPage.date = d;
  const pid = pidOf(line);
  if (pid) bfPendingPage.pageId = pid;
  if (bfPendingPage.date && bfPendingPage.pageId) {
    bfPagesByDate = { ...bfPagesByDate, [bfPendingPage.date]: bfPendingPage.pageId };
    bfPendingPage = null;
  }
}

export function resetBackfillTracking(): void {
  runProgress = null;
  bfTotal = 0;
  bfDone = 0;
  bfStarted = 0;
  bfInStat = false;
  bfLastKey = '';
  bfDates = [];
  bfDoneDates = [];
  bfStepByDate = {};
  bfStepBlock = null;
  bfCountsByDate = {};
  bfCountBlock = null;
  bfLastPublishedDate = null;
  bfPagesByDate = {};
  bfPendingPage = null;
}

// 'backfill date step' 블록에서 날짜별 단계(수집/요약/발행) 추출 — JSON 한 줄·pino-pretty 멀티라인 모두 대응
function trackDateStep(line: string): void {
  if (/backfill date step/.test(line)) {
    const dOne = /"date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/.exec(line);
    const sOne = /"step"\s*:\s*"(collect|summarize|publish)"/.exec(line);
    if (dOne && sOne) {
      bfStepByDate = { ...bfStepByDate, [dOne[1]!]: sOne[1] as DateStep };
      bfStepBlock = null;
    } else {
      bfStepBlock = {};
    }
    return;
  }
  if (!bfStepBlock) return;
  if (/^\[\d{2}:\d{2}:\d{2}/.test(line) || /"msg"\s*:/.test(line)) {
    bfStepBlock = null;
    return;
  }
  const d = /date["':\s]+["']?(\d{4}-\d{2}-\d{2})/.exec(line);
  const s = /step["':\s]+["']?(collect|summarize|publish)/.exec(line);
  if (d) bfStepBlock.date = d[1];
  if (s) bfStepBlock.step = s[1] as DateStep;
  if (bfStepBlock.date && bfStepBlock.step) {
    bfStepByDate = { ...bfStepByDate, [bfStepBlock.date]: bfStepBlock.step };
    bfStepBlock = null;
  }
}

// 날짜별 수집 수치(PR·커밋) 추출 — 'daily: publish done'(date+prCount+commitCountTotal),
// 'no activity collected'(0/0). JSON 한 줄·pino-pretty 멀티라인 블록 모두 대응.
function flushCountBlock(): void {
  const b = bfCountBlock;
  if (!b?.date) return;
  if (b.noActivity) {
    bfCountsByDate = { ...bfCountsByDate, [b.date]: { pr: 0, commit: 0 } };
    bfCountBlock = null;
  } else if (b.pr !== undefined && b.commit !== undefined) {
    bfCountsByDate = { ...bfCountsByDate, [b.date]: { pr: b.pr, commit: b.commit } };
    bfLastPublishedDate = b.date;
    bfCountBlock = null;
  }
}

function trackDateCounts(line: string): void {
  const isDone = /daily: publish done/.test(line);
  const isNoActivity = /no activity collected/.test(line);
  if (isDone || isNoActivity) {
    const d = /date["':\s]+["']?(\d{4}-\d{2}-\d{2})/.exec(line);
    const p = /prCount["':\s]+(\d+)/.exec(line);
    const c = /commitCountTotal["':\s]+(\d+)/.exec(line);
    bfCountBlock = {
      date: d?.[1],
      pr: isNoActivity ? 0 : p ? Number(p[1]) : undefined,
      commit: isNoActivity ? 0 : c ? Number(c[1]) : undefined,
      noActivity: isNoActivity,
    };
    flushCountBlock();
    return;
  }
  if (!bfCountBlock) return;
  if (/^\[\d{2}:\d{2}:\d{2}/.test(line) || /"msg"\s*:/.test(line)) {
    bfCountBlock = null;
    return;
  }
  const d = /date["':\s]+["']?(\d{4}-\d{2}-\d{2})/.exec(line);
  const p = /prCount["':\s]+(\d+)/.exec(line);
  const c = /commitCountTotal["':\s]+(\d+)/.exec(line);
  if (d) bfCountBlock.date = d[1];
  if (p && !bfCountBlock.noActivity) bfCountBlock.pr = Number(p[1]);
  if (c && !bfCountBlock.noActivity) bfCountBlock.commit = Number(c[1]);
  flushCountBlock();
}

// pino-pretty 멀티라인 대응: 헤더(`[HH:MM:SS]`) 기준 블록으로 total/done 누적, date start 수로 동시 처리 산정
export function trackBackfill(line: string, mode: CoreMode): void {
  if (line.includes('backfill date start')) bfStarted += 1;
  trackDateStep(line);
  trackDateCounts(line);
  trackPublishedPage(line);
  // 배치 시작 시 1회 찍히는 날짜 목록(쉼표 join) — 헤더/블록 어느 라인에 있어도 잡히게 무조건 검사
  // 음수 lookbehind 로 'doneDates' 는 제외(전체 대상 목록만)
  const mDates = /(?<![a-zA-Z])dates["':\s]+["']?([\d,-]+)/.exec(line);
  if (mDates?.[1]) {
    const parsed = mDates[1].split(',').filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (parsed.length > bfDates.length) bfDates = parsed;
  }
  // 완료된 날짜 누적 목록 — 동시 완료 순서가 날짜 순서와 달라도 UI 가 멤버십으로 상태 판정
  const mDone = /doneDates["':\s]+["']?([\d,-]+)/.exec(line);
  if (mDone?.[1]) {
    const parsed = mDone[1].split(',').filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (parsed.length >= bfDoneDates.length) bfDoneDates = parsed;
  }
  const isHeader = /^\[\d{2}:\d{2}:\d{2}/.test(line) || /"msg"\s*:/.test(line);
  if (isHeader) bfInStat = /backfill batch start|backfill progress/.test(line);
  else if (/backfill batch start|backfill progress/.test(line)) bfInStat = true;
  if (bfInStat) {
    const mt = /total["':\s]+(\d+)/.exec(line);
    const md = /done["':\s]+(\d+)/.exec(line);
    if (mt) bfTotal = Math.max(bfTotal, Number(mt[1]));
    if (md) bfDone = Math.max(bfDone, Number(md[1]));
  }
  if (bfTotal <= 1) return;
  const active = Math.max(0, Math.min(bfTotal - bfDone, bfStarted - bfDone));
  const stepSig = Object.entries(bfStepByDate)
    .map(([d, s]) => `${d}:${s}`)
    .sort()
    .join(',');
  const countSig = Object.entries(bfCountsByDate)
    .map(([d, v]) => `${d}:${v.pr}:${v.commit}`)
    .sort()
    .join(',');
  const key = `${bfDone}/${bfTotal}/${active}/${bfDates.length}/${bfDoneDates.length}/${stepSig}/${countSig}`;
  if (key === bfLastKey) return;
  bfLastKey = key;
  runProgress = {
    total: bfTotal,
    done: bfDone,
    active,
    dates: bfDates,
    doneDates: bfDoneDates,
    stepByDate: bfStepByDate,
    countsByDate: bfCountsByDate,
  };
  broadcast('cairn:run-progress', { mode, ...runProgress });
}

export function getRunProgress(): RunProgress | null {
  return runProgress;
}

export function getBackfillCountsByDate(): Record<string, DateCounts> {
  return bfCountsByDate;
}

export function getBackfillLastPublishedDate(): string | null {
  return bfLastPublishedDate;
}

export function getBackfillPagesByDate(): Record<string, string> {
  return bfPagesByDate;
}
