import { broadcast } from './broadcast';
import type { CoreMode } from './core-runner';
import type { ParentEvent } from './core-runner-extract';

// 백필 배치 진행 — fork-IPC 구조화 이벤트가 단일 소스 (ADR 0033 3단계, 로그 스크래핑 제거).
// 갱신은 전부 멱등(max·length 가드·키 맵)이라 이벤트 중복·순서 뒤섞임에 안전하다
export type DateStep = 'collect' | 'summarize' | 'publish';
export type DateCounts = { pr: number; commit: number };
export type RunProgress = {
  total: number;
  done: number;
  active: number;
  dates: string[];
  doneDates: string[];
  failedDates: string[];
  stepByDate: Record<string, DateStep>;
  countsByDate: Record<string, DateCounts>;
};
let runProgress: RunProgress | null = null;
let bfTotal = 0;
let bfDone = 0;
let bfStartedDates = new Set<string>();
let bfLastKey = '';
let bfDates: string[] = [];
let bfDoneDates: string[] = [];
let bfFailedDates: string[] = [];
let bfStepByDate: Record<string, DateStep> = {};
let bfCountsByDate: Record<string, DateCounts> = {};
let bfLastPublishedDate: string | null = null;
let bfPagesByDate: Record<string, string> = {};

export function resetBackfillTracking(): void {
  runProgress = null;
  bfTotal = 0;
  bfDone = 0;
  bfStartedDates = new Set();
  bfLastKey = '';
  bfDates = [];
  bfDoneDates = [];
  bfFailedDates = [];
  bfStepByDate = {};
  bfCountsByDate = {};
  bfLastPublishedDate = null;
  bfPagesByDate = {};
}

function publishProgress(mode: CoreMode): void {
  if (bfTotal <= 1) return;
  const started = bfStartedDates.size;
  const active = Math.max(0, Math.min(bfTotal - bfDone, started - bfDone));
  const stepSig = Object.entries(bfStepByDate)
    .map(([d, s]) => `${d}:${s}`)
    .sort()
    .join(',');
  const countSig = Object.entries(bfCountsByDate)
    .map(([d, v]) => `${d}:${v.pr}:${v.commit}`)
    .sort()
    .join(',');
  const key = `${bfDone}/${bfTotal}/${active}/${bfDates.length}/${bfDoneDates.length}/${bfFailedDates.length}/${stepSig}/${countSig}`;
  if (key === bfLastKey) return;
  bfLastKey = key;
  runProgress = {
    total: bfTotal,
    done: bfDone,
    active,
    dates: bfDates,
    doneDates: bfDoneDates,
    failedDates: bfFailedDates,
    stepByDate: bfStepByDate,
    countsByDate: bfCountsByDate,
  };
  broadcast('cairn:run-progress', { mode, ...runProgress });
}

// 구조화 이벤트 (ADR 0033) — 배치 진행의 단일 소스
export function applyBackfillEvent(event: ParentEvent, mode: CoreMode): void {
  switch (event.type) {
    case 'backfill-start':
      bfTotal = Math.max(bfTotal, event.total);
      if (event.dates.length > bfDates.length) bfDates = event.dates;
      break;
    case 'backfill-date-start':
      bfStartedDates.add(event.date);
      break;
    case 'date-step':
      bfStepByDate = { ...bfStepByDate, [event.date]: event.step };
      break;
    case 'backfill-progress':
      bfDone = Math.max(bfDone, event.done);
      bfTotal = Math.max(bfTotal, event.total);
      if (event.doneDates.length >= bfDoneDates.length) bfDoneDates = event.doneDates;
      if (event.failedDates.length >= bfFailedDates.length) bfFailedDates = event.failedDates;
      break;
    case 'day-done':
      bfCountsByDate = { ...bfCountsByDate, [event.date]: { pr: event.pr, commit: event.commit } };
      bfLastPublishedDate = event.date;
      if (event.pageId) bfPagesByDate = { ...bfPagesByDate, [event.date]: event.pageId };
      break;
    case 'no-activity':
      bfCountsByDate = { ...bfCountsByDate, [event.date]: { pr: 0, commit: 0 } };
      break;
    default:
      return;
  }
  publishProgress(mode);
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
