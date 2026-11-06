import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const cp = vi.hoisted(() => ({ execFile: vi.fn(), spawn: vi.fn() }));
vi.mock('node:child_process', () => cp);

import { CairnError } from './error.js';
import {
  codexArgs,
  dropNulls,
  parseEnabledFeatures,
  runCodexSubmitAgent,
  strictOutputSchema,
} from './codex-submit-agent.js';
import { submitPeriodDocSchema } from '../period-doc/period-doc-tools.js';
import { submitRollupSchema } from '../rollup/rollup-tools.js';
import { submitSummarySchema } from '../summarizer/summarizer-tools.js';

const FEATURES = [
  'apps                       stable             true',
  'shell_tool                 stable             true',
  'sleep_tool                 under development  true',
  'memories                   experimental       false',
  'collaboration_modes        removed            true',
].join('\n');

interface FakeChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
  stdin: Writable;
  kill: ReturnType<typeof vi.fn>;
}

// 이벤트를 JSONL 로 흘리고 닫히는 가짜 codex 프로세스 — kill 되면 이후 줄은 안 보냄
function fakeCodex(events: object[], exitCode = 0): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new Writable({ write: (_c, _e, cb) => cb() });
  let killed = false;
  child.kill = vi.fn(() => (killed = true));
  setImmediate(() => {
    for (const e of events) if (!killed) child.stdout.write(`${JSON.stringify(e)}\n`);
    child.stdout.end();
    child.stdout.on('end', () => setImmediate(() => child.emit('close', killed ? null : exitCode)));
  });
  return child;
}

const message = (text: string) => ({
  type: 'item.completed',
  item: { type: 'agent_message', text },
});
const done = {
  type: 'turn.completed',
  usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 20 },
};

const schema = z.object({ text: z.string().min(1) });
const run = () =>
  runCodexSubmitAgent({
    serverName: 's',
    toolName: 't',
    toolDescription: 'd',
    schema,
    systemPrompt: 'sys',
    prompt: 'p',
  });

beforeEach(() => {
  cp.execFile
    .mockReset()
    .mockImplementation((_b, _a, _o, cb: (e: null, out: string) => void) => cb(null, FEATURES));
  cp.spawn.mockReset();
  process.env.GITHUB_TOKEN_TEST = 'ghp_secret';
});
afterEach(() => {
  delete process.env.GITHUB_TOKEN_TEST;
  delete process.env.CAIRN_CODEX_MODEL;
});

describe('parseEnabledFeatures', () => {
  it('keeps every enabled feature that is not removed', () => {
    expect(parseEnabledFeatures(FEATURES)).toEqual(['apps', 'shell_tool', 'sleep_tool']);
  });

  it('refuses output it cannot read', () => {
    expect(() => parseEnabledFeatures('')).toThrow(CairnError);
    expect(() => parseEnabledFeatures('apps stable yes')).toThrow(CairnError);
  });
});

describe('codexArgs', () => {
  it('isolates the run and disables every listed feature', () => {
    const args = codexArgs('/tmp/w', '/tmp/w/schema.json', ['shell_tool', 'apps']);
    expect(args).toEqual(
      expect.arrayContaining([
        '--ephemeral',
        '--ignore-user-config',
        '--ignore-rules',
        'web_search="disabled"',
        'shell_environment_policy.inherit="none"',
      ]),
    );
    expect(args.join(' ')).toContain('--disable shell_tool --disable apps');
    expect(args.join(' ')).toContain('-C /tmp/w');
    expect(args.join(' ')).toContain('--sandbox read-only');
    expect(args.at(-1)).toBe('-');
    expect(args).not.toContain('-m');
  });

  it('passes a chosen model', () => {
    expect(codexArgs('/w', '/w/s.json', [], 'gpt-5.6-luna').join(' ')).toContain('-m gpt-5.6-luna');
  });
});

// strict 모드 규칙 — 속성이 있는 모든 object 는 properties 키 전부가 required
function strictViolations(node: unknown, path = '$'): string[] {
  if (Array.isArray(node)) return node.flatMap((v, i) => strictViolations(v, `${path}[${i}]`));
  if (!node || typeof node !== 'object') return [];
  const o = node as Record<string, unknown>;
  const own: string[] = [];
  if (o.properties && typeof o.properties === 'object') {
    const required = new Set((o.required as string[] | undefined) ?? []);
    for (const k of Object.keys(o.properties)) if (!required.has(k)) own.push(`${path}.${k}`);
  }
  return [...own, ...Object.entries(o).flatMap(([k, v]) => strictViolations(v, `${path}/${k}`))];
}

describe('strictOutputSchema', () => {
  it.each([
    ['summary', submitSummarySchema],
    ['rollup', submitRollupSchema],
    ['period-doc', submitPeriodDocSchema],
  ])('makes the %s schema acceptable to strict mode', (_name, s) => {
    const json = z.toJSONSchema(s, { target: 'draft-7' });
    expect(strictViolations(strictOutputSchema(json))).toEqual([]);
  });

  it('keeps optional fields optional by allowing null', () => {
    const out = strictOutputSchema(
      z.toJSONSchema(z.object({ a: z.string(), b: z.string().optional() }), { target: 'draft-7' }),
    ) as { required: string[]; properties: Record<string, unknown> };
    expect(out.required).toEqual(['a', 'b']);
    expect(out.properties.b).toEqual({ anyOf: [{ type: 'string' }, { type: 'null' }] });
  });

  it('round-trips a null optional back through the zod schema', () => {
    const parsed = submitPeriodDocSchema.parse(
      dropNulls({ overview: 'o', projects: [{ name: 'cairn', summary: null, items: ['x'] }] }),
    );
    expect(parsed.projects[0]).toEqual({ name: 'cairn', items: ['x'] });
  });
});

describe('runCodexSubmitAgent', () => {
  it('parses the final message against the schema', async () => {
    cp.spawn.mockImplementation(() => fakeCodex([message('{"text":"ok"}'), done]));
    const r = await run();
    expect(r.submission).toEqual({ text: 'ok' });
    expect(r.usage).toMatchObject({ inputTokens: 100, cacheReadTokens: 40, outputTokens: 20 });
    const args = cp.spawn.mock.calls[0]![1] as string[];
    expect(args.join(' ')).toContain('--disable apps --disable shell_tool --disable sleep_tool');
  });

  it('ignores a model value that is not a model id', async () => {
    process.env.CAIRN_CODEX_MODEL = '--dangerously-bypass-approvals-and-sandbox';
    cp.spawn.mockImplementation(() => fakeCodex([message('{"text":"ok"}'), done]));
    await run();
    expect(cp.spawn.mock.calls[0]![1]).not.toContain('-m');
  });

  it('tells the model there is no submit tool', async () => {
    let stdin = '';
    cp.spawn.mockImplementation(() => {
      const child = fakeCodex([message('{"text":"ok"}'), done]);
      child.stdin = new Writable({ write: (c: Buffer, _e, cb) => ((stdin += c.toString()), cb()) });
      return child;
    });
    await run();
    expect(stdin).toContain('There is no t tool here');
  });

  it('does not hand tokens to the codex process', async () => {
    cp.spawn.mockImplementation(() => fakeCodex([message('{"text":"ok"}'), done]));
    await run();
    const { env } = cp.spawn.mock.calls[0]![2] as { env: Record<string, string> };
    expect(env.GITHUB_TOKEN_TEST).toBeUndefined();
    expect(
      Object.keys(env).every((k) => ['PATH', 'HOME', 'TMPDIR', 'LANG', 'CODEX_HOME'].includes(k)),
    ).toBe(true);
  });

  it('kills the run and discards the result when a tool item appears', async () => {
    const child = fakeCodex([
      { type: 'item.started', item: { type: 'command_execution' } },
      message('{"text":"leaked"}'),
      done,
    ]);
    cp.spawn.mockImplementation(() => child);
    await expect(run()).rejects.toMatchObject({ code: 'forbidden' });
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('rejects a final message that fails the schema', async () => {
    cp.spawn.mockImplementation(() => fakeCodex([message('{"text":""}'), done]));
    await expect(run()).rejects.toBeInstanceOf(CairnError);
  });

  it('turns an early stdin pipe error into a reported failure, not a crash', async () => {
    cp.spawn.mockImplementation(() => {
      const child = fakeCodex([], 1);
      setImmediate(() =>
        child.stdin.emit('error', Object.assign(new Error('EPIPE'), { code: 'EPIPE' })),
      );
      return child;
    });
    await expect(run()).rejects.toBeInstanceOf(CairnError);
  });

  it('surfaces a failed turn', async () => {
    cp.spawn.mockImplementation(() =>
      fakeCodex([{ type: 'turn.failed', error: { message: 'model not supported' } }], 1),
    );
    await expect(run()).rejects.toThrow(/model not supported/);
  });

  it('does not run when the feature list cannot be read', async () => {
    cp.execFile.mockImplementation((_b, _a, _o, cb: (e: null, out: string) => void) =>
      cb(null, ''),
    );
    await expect(run()).rejects.toBeInstanceOf(CairnError);
    expect(cp.spawn).not.toHaveBeenCalled();
  });
});
