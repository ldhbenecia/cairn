import type { CoreResult } from '../cairn-api';

// 발행 결과 → 대상별(로컬 일지·Notion·Obsidian) 체크. 발행 대상이 유동적이 된 뒤
// (--skip-notion, 로컬-온리, 부분 실패) "이번 발행이 어디에 갔나"를 결과 화면에 명시하는 근거.
// 일지가 기록됐거나 기록에 실패한 런에서만 의미가 있고, 취소·활동 없음은 빈 배열(행 미표시)

export type SinkState = 'ok' | 'skipped' | 'failed';
export type SinkOutcome = { sink: 'journal' | 'notion' | 'obsidian'; state: SinkState };

export function deriveSinkOutcomes(input: {
  result: Pick<
    CoreResult,
    'journalFile' | 'journalWriteFailed' | 'notionUrl' | 'publishKind' | 'noActivity' | 'cancelled'
  >;
  skipNotion: boolean;
  // Obsidian 미러(export.folder + autoSync)가 설정돼 있는지 — 미설정이면 행 자체를 숨긴다
  obsidianConfigured: boolean;
}): SinkOutcome[] {
  const { result, skipNotion, obsidianConfigured } = input;
  if (result.cancelled || result.noActivity) return [];
  const journalState: SinkState | null = result.journalWriteFailed
    ? 'failed'
    : result.journalFile
      ? 'ok'
      : null;
  if (journalState === null) return [];

  const notionOk =
    result.publishKind === 'created' || result.publishKind === 'recreated' || !!result.notionUrl;
  const notionState: SinkState = skipNotion
    ? 'skipped'
    : notionOk
      ? 'ok'
      : result.publishKind === 'no-target' || result.publishKind === 'skipped'
        ? 'skipped'
        : 'failed';

  const out: SinkOutcome[] = [
    { sink: 'journal', state: journalState },
    { sink: 'notion', state: notionState },
  ];
  // export 미러 복사는 main 이 발행 직후 동기 수행(core-runner) — 일지가 기록됐으면 함께 반영됨
  if (obsidianConfigured) {
    out.push({ sink: 'obsidian', state: journalState === 'ok' ? 'ok' : 'skipped' });
  }
  return out;
}
