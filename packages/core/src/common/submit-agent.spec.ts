import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@anthropic-ai/claude-agent-sdk', () => sdk);

import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
import { CairnError } from './error.js';
import { runSubmitAgent } from './submit-agent.js';

const server = { type: 'sdk', name: 'cairn-test' } as unknown as McpSdkServerConfigWithInstance;

const throwing = (): AsyncIterable<unknown> => ({
  [Symbol.asyncIterator]: () => ({
    next: () => Promise.reject(new Error('Reached maximum number of turns')),
  }),
});

beforeEach(() => sdk.query.mockReset().mockImplementation(() => throwing()));

const run = (submission: string | null) =>
  runSubmitAgent({
    prompt: 'p',
    systemPrompt: 's',
    server,
    toolName: 'submit_x',
    getSubmission: () => submission,
  });

describe('runSubmitAgent', () => {
  it('derives the allowed tool id from the server name', async () => {
    await run('ok');
    const { options } = sdk.query.mock.calls[0]![0] as { options: { allowedTools: string[] } };
    expect(options.allowedTools).toEqual(['mcp__cairn-test__submit_x']);
  });

  it('keeps a submission that arrived before the SDK threw', async () => {
    const r = await run('ok');
    expect(r.submission).toBe('ok');
    expect(r.usage.resultSubtype).toBe('errored_after_submit');
    expect(r.lateError).toBeInstanceOf(CairnError);
  });

  it('rethrows as CairnError when nothing was submitted', async () => {
    await expect(run(null)).rejects.toBeInstanceOf(CairnError);
  });
});
