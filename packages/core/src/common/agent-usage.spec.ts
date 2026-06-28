import { describe, expect, it } from 'vitest';
import { accumulateAgentUsage } from './agent-usage.js';

async function* messages(items: unknown[]): AsyncIterable<unknown> {
  await Promise.resolve();
  for (const i of items) yield i;
}

describe('accumulateAgentUsage', () => {
  it('sums tokens (incl. cache) and cost across modelUsage entries', async () => {
    const usage = await accumulateAgentUsage(
      messages([
        { type: 'assistant' },
        {
          type: 'result',
          subtype: 'success',
          total_cost_usd: 0.42,
          modelUsage: {
            'claude-x': {
              inputTokens: 100,
              outputTokens: 20,
              cacheReadInputTokens: 5,
              cacheCreationInputTokens: 3,
            },
            'claude-y': { inputTokens: 10, outputTokens: 2 },
          },
        },
      ]),
    );
    expect(usage).toEqual({
      resultSubtype: 'success',
      inputTokens: 118, // 100 + 5 + 3 + 10
      outputTokens: 22,
      costUsd: 0.42,
    });
  });

  it('defaults to unknown subtype + zero usage when no result message', async () => {
    const usage = await accumulateAgentUsage(messages([{ type: 'assistant' }]));
    expect(usage).toEqual({
      resultSubtype: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    });
  });
});
