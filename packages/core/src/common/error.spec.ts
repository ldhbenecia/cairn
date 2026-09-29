import { describe, expect, it } from 'vitest';
import { CairnError } from './error.js';

describe('CairnError.from', () => {
  it('never yields an empty message for a thrown undefined', () => {
    expect(CairnError.from(undefined, 'summarizer').message).toBe('undefined');
  });

  it('keeps the name for a message-less Error', () => {
    expect(CairnError.from(new TypeError(''), 'summarizer').message).toBe('TypeError');
  });

  it('serializes plain objects', () => {
    expect(CairnError.from({ a: 1 }, 'summarizer').message).toBe('{"a":1}');
  });
});
