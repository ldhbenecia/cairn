import { afterEach, describe, expect, it } from 'vitest';
import { summaryModelOption } from './summary-model.js';

const ENV = 'CAIRN_SUMMARY_MODEL';

afterEach(() => {
  delete process.env[ENV];
});

describe('summaryModelOption', () => {
  it('passes through known aliases as the model', () => {
    for (const alias of ['sonnet', 'haiku', 'opus']) {
      process.env[ENV] = alias;
      expect(summaryModelOption()).toEqual({ model: alias });
    }
  });

  it('normalizes case and whitespace', () => {
    process.env[ENV] = '  Sonnet  ';
    expect(summaryModelOption()).toEqual({ model: 'sonnet' });
  });

  it('returns no override for default / unset / unknown', () => {
    delete process.env[ENV];
    expect(summaryModelOption()).toEqual({});
    process.env[ENV] = 'default';
    expect(summaryModelOption()).toEqual({});
    process.env[ENV] = 'gpt-4';
    expect(summaryModelOption()).toEqual({});
  });
});
