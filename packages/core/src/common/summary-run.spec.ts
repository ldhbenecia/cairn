import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const sa = vi.hoisted(() => ({ runSubmitAgent: vi.fn() }));
vi.mock('./submit-agent.js', () => sa);
const op = vi.hoisted(() => ({ isOperator: vi.fn(() => false) }));
vi.mock('./operator.js', () => op);

import type { PinoLogger } from 'nestjs-pino';
import { CairnError } from './error.js';
import { runSummaryAgent } from './summary-run.js';

const info = vi.fn();
const logger = { info, warn: vi.fn() } as unknown as PinoLogger;
const usage = (resultSubtype: string) => ({
  resultSubtype,
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd: 0.01,
  model: 'm',
});
const run = () =>
  runSummaryAgent(
    {
      serverName: 's',
      toolName: 'submit_x',
      toolDescription: 'd',
      schema: z.object({ text: z.string() }),
      prompt: 'p',
      systemPrompt: 'sys',
    },
    { logger, label: 'summarizer', ctx: { date: '2026-11-05' } },
  );

beforeEach(() => {
  sa.runSubmitAgent.mockReset();
  op.isOperator.mockReturnValue(false);
  info.mockClear();
});

describe('runSummaryAgent', () => {
  it('reports the failure cause before falling back', async () => {
    const sent: unknown[] = [];
    // eslint-disable-next-line @typescript-eslint/unbound-method -- 원본 참조 저장 후 원복 (호출 안 함)
    const original = process.send;
    process.send = ((m: unknown) => (sent.push(m), true)) as never;
    try {
      sa.runSubmitAgent.mockRejectedValueOnce(
        new CairnError('summarizer', 'auth_failed', 'expired'),
      );
      await expect(run()).resolves.toBeNull();
      expect(sent).toContainEqual({
        cairn: 1,
        type: 'failure',
        source: 'summarizer',
        code: 'auth_failed',
      });
    } finally {
      process.send = original;
    }
  });

  it('falls back to null when the agent throws or submits nothing', async () => {
    sa.runSubmitAgent.mockRejectedValueOnce(new Error('boom'));
    await expect(run()).resolves.toBeNull();
    sa.runSubmitAgent.mockResolvedValueOnce({
      usage: usage('success'),
      submission: null,
      lateError: null,
    });
    await expect(run()).resolves.toBeNull();
  });

  it('keeps a submission from a non-success run and logs the finished line', async () => {
    sa.runSubmitAgent.mockResolvedValue({
      usage: usage('error_max_turns'),
      submission: { text: 'ok' },
      lateError: null,
    });
    await expect(run()).resolves.toEqual({ text: 'ok' });
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-11-05', resultSubtype: 'error_max_turns' }),
      'summarizer finished',
    );
  });

  it('attaches usage only for the operator', async () => {
    op.isOperator.mockReturnValue(true);
    sa.runSubmitAgent.mockResolvedValue({
      usage: usage('success'),
      submission: { text: 'ok' },
      lateError: null,
    });
    await expect(run()).resolves.toEqual({
      text: 'ok',
      usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.01, model: 'm' },
    });
  });
});
