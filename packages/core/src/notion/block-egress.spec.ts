import { describe, expect, it, vi } from 'vitest';
import { enforceBlockEgress } from './block-egress.js';
import { bulletItem, claudeCallout, paragraph } from './notion-blocks.js';

const FALLBACK = [claudeCallout('fallback callout')];
const LEAKED_PATH = '/Users/leak/secret-work.ts';
const LEAKED_TOKEN = `ghp_${'a'.repeat(36)}`;

function makeLogger() {
  return { warn: vi.fn((_obj: unknown, _msg?: string) => {}) };
}

describe('enforceBlockEgress', () => {
  it('passes clean blocks through unchanged', () => {
    const logger = makeLogger();
    const blocks = [paragraph('clean one'), bulletItem('clean two')];

    const out = enforceBlockEgress(blocks, () => FALLBACK, 'test', logger);

    expect(out).toEqual(blocks);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('drops only the violating block and keeps the rest (ADR 0021 item-drop)', () => {
    const logger = makeLogger();
    const blocks = [
      paragraph('clean one'),
      bulletItem(`token leaked ${LEAKED_TOKEN}`),
      paragraph('clean two'),
    ];

    const out = enforceBlockEgress(blocks, () => FALLBACK, 'test', logger);

    expect(out).toEqual([blocks[0], blocks[2]]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [obj] = logger.warn.mock.calls[0]!;
    expect(obj).toMatchObject({ index: 1, blockType: 'bulleted_list_item' });
    expect(String((obj as { err: string }).err)).toContain('github-token-classic');
    // warn 로그에 블록 내용이 새면 안 된다
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('ghp_');
  });

  it('degrades to fallback when every block violates', () => {
    const logger = makeLogger();
    const blocks = [paragraph(`wip at ${LEAKED_PATH}`), bulletItem(`also ${LEAKED_PATH}`)];

    const out = enforceBlockEgress(blocks, () => FALLBACK, 'test', logger);

    expect(out).toEqual(FALLBACK);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(LEAKED_PATH);
  });

  it('throws when the fallback also violates (fail-closed)', () => {
    const logger = makeLogger();
    const blocks = [paragraph(LEAKED_PATH)];

    expect(() =>
      enforceBlockEgress(blocks, () => [paragraph(LEAKED_PATH)], 'test', logger),
    ).toThrow(/fallback also tripped forbidden pattern/);
  });
});
