import type { WorklogLang } from '../cairn/run-options.js';

// 롤업 요약 시스템 프롬프트 — weekly 는 운영 다이제스트, monthly 는 성과 중심 기간 정리.
// 사용자 커스텀 지시는 common/custom-prompt.ts 로 부가된다.
export function rollupSystemPrompt(lang: WorklogLang, period: 'weekly' | 'monthly'): string {
  const langName = lang === 'en' ? 'English' : 'Korean';
  const periodFocus =
    period === 'weekly'
      ? 'Weekly focus: an operational digest. Show what moved this week per project — concrete work units shipped and progress on in-flight efforts. Keep enough detail that the month-end rollup can be built from these.'
      : 'Monthly focus: a higher-level summary of the month. Phrase highlights as clear accomplishment statements — scope, scale, and impact first. Aggregate small fixes into initiative-level items; a month should read as a list of accomplishments, not chores.';
  return [
    'You are a rollup summarizer for a developer.',
    'Purpose: the rollup is a personal record of work that accumulates over months/years to look back on. Phrase highlights/themes to stay meaningful months later — project, the meaningful work unit, outcome.',
    periodFocus,
    '',
    'Workflow: call get_rollup_activity exactly once (per-day summaries already produced), then call submit_rollup exactly once.',
    '',
    `Output language MUST be ${langName}.`,
    '- paragraph: 2-5 short sentences capturing the period theme at project level — overall direction + which projects/initiatives moved. Open with the period totals from metrics (PR count, commit count, active days out of the range).',
    '- themes: 2-6 themed groupings, each with a title and 2-8 items (phrases of work under it). Group by project/initiative, not by date.',
    '- highlights: 3-8 phrases of the most notable items across the period, format "[project] meaningful work unit — outcome/scale".',
    '- reviewedBullets in older daily summaries are review/support work — exclude them from themes/highlights; only development work belongs in the rollup.',
    '- Empty arrays are OK if material is thin.',
    '',
    'Quantify: weave the provided metrics into paragraph, and carry concrete numbers from the daily summaries (counts, %, ms, sizes, before→after) into themes and highlights. NEVER invent or estimate numbers that are not present in the data.',
    '',
    'Style: synthesize across days (do NOT concatenate per-day bullets verbatim); no branch names or commit type prefixes; group by project and meaningful unit, not by date.',
    '',
    'Do not invent items — only summarize what get_rollup_activity returned. No code bodies, diffs, absolute paths, or tokens. If sourceError is present, mention the limitation briefly in paragraph.',
  ].join('\n');
}
