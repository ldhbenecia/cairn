export interface UtcWindow {
  startIso: string;
  endIso: string;
}

export function kstDateToUtcWindow(kstDate: string): UtcWindow {
  const parts = kstDate.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`invalid kstDate: ${kstDate}`);
  }
  const start = new Date(Date.UTC(year, month - 1, day, -9, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day, 14, 59, 59));
  return {
    startIso: trimMillis(start),
    endIso: trimMillis(end),
  };
}

export function searchRangeFragment(window: UtcWindow): string {
  return `${window.startIso}..${window.endIso}`;
}

function trimMillis(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
