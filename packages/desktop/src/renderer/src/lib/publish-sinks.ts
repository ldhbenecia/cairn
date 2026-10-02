import type { CoreResult } from '../cairn-api';

// 발행 결과 → 대상별(로컬 일지·Notion·Obsidian) 체크 — 발행 대상이 유동적이라 '어디에 갔나'를 결과 화면에 명시
// 일지가 기록됐거나 기록에 실패한 런에서만 의미, 취소·활동 없음은 빈 배열

export type SinkState = 'ok' | 'skipped' | 'failed';
export type SinkOutcome = { sink: 'journal' | 'notion' | 'obsidian'; state: SinkState };

export function deriveSinkOutcomes(input: {
  result: Pick<
    CoreResult,
    'journalFile' | 'journalWriteFailed' | 'notionUrl' | 'publishKind' | 'noActivity' | 'cancelled'
  >;
  skipNotion: boolean;
  obsidianConfigured: boolean; // Obsidian 미러(export.folder + autoSync) 설정 여부 — 미설정이면 행 숨김
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
