import { describe, expect, it } from 'vitest';
import { accumulateAgentUsage } from './agent-usage.js';

async function* messages(items: unknown[]): AsyncIterable<unknown> {
  await Promise.resolve();
  for (const i of items) yield i;
}

async function* throwingAfter(items: unknown[], thrown: unknown): AsyncIterable<unknown> {
  yield* messages(items);
  throw thrown;
}

const notLoggedIn = {
  type: 'result',
  subtype: 'success',
  is_error: true,
  result: 'Not logged in · Please run /login',
};

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
      cacheReadTokens: 5, // inputTokens 에도 합산 유지
      cacheCreationTokens: 3,
      costUsd: 0.42,
      model: 'claude-x', // 출력 토큰이 가장 많은 모델이 대표
    });
  });

  it('defaults to unknown subtype + zero usage when no result message', async () => {
    const usage = await accumulateAgentUsage(messages([{ type: 'assistant' }]));
    expect(usage).toEqual({
      resultSubtype: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 0,
    });
  });

  it('throws the result text for an is_error success result even when the SDK does not', async () => {
    await expect(accumulateAgentUsage(messages([notLoggedIn]))).rejects.toThrow(
      'Not logged in · Please run /login',
    );
  });

  it('replaces a message-less SDK throw with the captured result text', async () => {
    await expect(accumulateAgentUsage(throwingAfter([notLoggedIn], undefined))).rejects.toThrow(
      'Not logged in · Please run /login',
    );
  });

  it('keeps a descriptive SDK error as-is', async () => {
    await expect(
      accumulateAgentUsage(
        throwingAfter([notLoggedIn], new Error('Claude Code returned an error result: x')),
      ),
    ).rejects.toThrow('Claude Code returned an error result: x');
  });

  it('does not throw for error subtypes without result text (max-turns path)', async () => {
    const usage = await accumulateAgentUsage(
      messages([{ type: 'result', subtype: 'error_max_turns', is_error: true }]),
    );
    expect(usage.resultSubtype).toBe('error_max_turns');
  });
});
