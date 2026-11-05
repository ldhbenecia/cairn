import { execFile, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { z } from 'zod';
import type { AgentUsage } from './agent-usage.js';
import { CairnError } from './error.js';
import type { SubmitAgentRun, SubmitTask } from './submit-agent.js';
import { codexModel } from './summary-provider.js';

// 메시지·추론 외 항목(명령 실행·파일 변경·MCP·웹 검색 등)이 보이면 격리가 뚫린 것
const ALLOWED_ITEM_TYPES = new Set(['agent_message', 'reasoning', 'error']);
// 정상 실행은 30초 안팎 — 네트워크 정체·새 대화형 프롬프트로 멈추면 발행 run 이 busy 로 남지 않게 끊음
const CODEX_TIMEOUT_MS = 5 * 60_000;

export function codexBinary(): string {
  return process.env.CAIRN_CODEX_PATH || 'codex';
}

// 도구는 기능 플래그로 흩어져 있고 버전마다 늘어남 — 고정 목록 대신 실행마다 켜진 기능을 전부 끔
// 형식을 못 읽으면 실행 거부 (새 도구가 열린 채 실행되는 것보다 실패가 안전)
export function parseEnabledFeatures(out: string): string[] {
  const rows = out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\s{2,}/));
  if (rows.length === 0 || rows.some((r) => r.length !== 3 || !/^(true|false)$/.test(r[2]!))) {
    throw new CairnError('summarizer', 'unknown', 'codex features list: unexpected format');
  }
  return rows
    .filter(([, stage, on]) => on === 'true' && stage !== 'removed')
    .map(([name]) => name!);
}

function listEnabledFeatures(env: NodeJS.ProcessEnv): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile(codexBinary(), ['features', 'list'], { env, encoding: 'utf8' }, (err, out) => {
      if (err) reject(CairnError.from(err, 'summarizer'));
      else {
        try {
          resolve(parseEnabledFeatures(out));
        } catch (e) {
          reject(CairnError.from(e, 'summarizer'));
        }
      }
    });
  });
}

// 발행 run 의 core env 에는 GitHub·Notion 토큰이 있음 — codex 에는 인증(~/.codex)과 실행에 필요한 키만
function codexEnv(): NodeJS.ProcessEnv {
  const { PATH, HOME, TMPDIR, LANG, CODEX_HOME } = process.env;
  return Object.fromEntries(
    Object.entries({ PATH, HOME, TMPDIR, LANG, CODEX_HOME }).filter(([, v]) => v),
  );
}

export function codexArgs(
  workDir: string,
  schemaPath: string,
  features: string[],
  model?: string,
): string[] {
  return [
    'exec',
    '--json',
    '--ephemeral',
    '--skip-git-repo-check',
    '--ignore-user-config', // 사용자 MCP 서버·프로필·모델 지정 미적용
    '--ignore-rules',
    ...['-C', workDir], // 빈 임시 디렉토리 — AGENTS.md 등 프로젝트 문맥 없음
    ...['--sandbox', 'read-only'],
    ...['-c', 'web_search="disabled"'],
    ...['-c', 'shell_environment_policy.inherit="none"'],
    ...['-c', 'model_reasoning_effort="low"'], // 요약은 추론 태스크가 아님
    ...['--output-schema', schemaPath],
    ...(model ? ['-m', model] : []), // 미지정이면 계정 기본 — ChatGPT 계정은 목록 밖 모델을 거절
    ...features.flatMap((f) => ['--disable', f]),
    '-', // 프롬프트는 stdin — argv 로 넘기면 ps 에 노출
  ];
}

interface CodexEvent {
  type?: string;
  item?: { type?: string; text?: string };
  usage?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    cache_write_input_tokens?: number;
    output_tokens?: number;
  };
  error?: { message?: string };
  message?: string;
}

function usageFrom(e: CodexEvent | undefined): AgentUsage {
  return {
    resultSubtype: e ? 'success' : 'no_result',
    inputTokens: e?.usage?.input_tokens ?? 0,
    outputTokens: e?.usage?.output_tokens ?? 0,
    cacheReadTokens: e?.usage?.cached_input_tokens ?? 0,
    cacheCreationTokens: e?.usage?.cache_write_input_tokens ?? 0,
    costUsd: 0, // ChatGPT 구독 실행 — 토큰 과금 없음
  };
}

export async function runCodexSubmitAgent<S extends z.ZodObject>(
  task: SubmitTask<S>,
): Promise<SubmitAgentRun<z.output<S>>> {
  const env = codexEnv();
  const features = await listEnabledFeatures(env);
  const workDir = mkdtempSync(join(tmpdir(), 'cairn-codex-'));
  try {
    const schemaPath = join(workDir, 'schema.json');
    writeFileSync(schemaPath, JSON.stringify(z.toJSONSchema(task.schema, { target: 'draft-7' })));
    const child = spawn(codexBinary(), codexArgs(workDir, schemaPath, features, codexModel()), {
      cwd: workDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // 프롬프트는 제출 도구 호출을 전제로 씀 — 도구가 없다는 사정을 모델이 결과 본문(Notes 등)에 적지 않도록 대체 경로를 명시
    const note = `There is no ${task.toolName} tool here. Return exactly what you would have submitted as your final message: one JSON object matching the output schema. Do not mention tools or this substitution anywhere in it.`;
    // codex 가 stdin 을 읽기 전에 끝나면 EPIPE — 리스너가 없으면 uncaught 로 core 가 죽음, 실패는 close 에서 보고
    child.stdin.on('error', () => {});
    child.stdin.end(`${task.systemPrompt}\n\n${note}\n\n${task.prompt}`);

    // 이벤트 콜백에서 채움 — 지역 let 이면 TS 가 null 로 좁혀 이후 분기를 never 로 봄
    const seen: {
      lastMessage: string | null;
      completed?: CodexEvent;
      failure: string | null;
      violation: string | null;
    } = { lastMessage: null, failure: null, violation: null };
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      let e: CodexEvent;
      try {
        e = JSON.parse(line) as CodexEvent;
      } catch {
        return;
      }
      const itemType = e.item?.type;
      if (itemType && !ALLOWED_ITEM_TYPES.has(itemType) && !seen.violation) {
        // 도구 결과가 다음 요청으로 나가기 전에 끊음 — 열거 차단의 보조 장치
        seen.violation = itemType;
        child.kill('SIGKILL');
      }
      if (e.type === 'item.completed' && itemType === 'agent_message')
        seen.lastMessage = e.item?.text ?? null;
      if (e.type === 'turn.completed') seen.completed = e;
      if (e.type === 'turn.failed') seen.failure = e.error?.message ?? 'turn failed';
    });
    let stderr = '';
    child.stderr.on('data', (b: Buffer) => (stderr = (stderr + b.toString('utf8')).slice(-2000)));

    const timer = setTimeout(() => {
      seen.failure = 'timed out';
      child.kill('SIGKILL');
    }, CODEX_TIMEOUT_MS);
    const code = await new Promise<number | null>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    })
      .catch((err: unknown) => {
        throw CairnError.from(err, 'summarizer');
      })
      .finally(() => clearTimeout(timer));

    if (seen.violation) {
      throw new CairnError(
        'summarizer',
        'forbidden',
        `codex used a tool (${seen.violation}) — result discarded`,
      );
    }
    if (seen.failure || code !== 0) {
      throw new CairnError(
        'summarizer',
        'unknown',
        `codex: ${seen.failure ?? (stderr.trim() || `exit ${code}`)}`,
      );
    }
    const usage = usageFrom(seen.completed);
    if (seen.lastMessage === null) return { usage, submission: null, lateError: null };
    let submission: z.output<S>;
    try {
      submission = task.schema.parse(JSON.parse(seen.lastMessage));
    } catch (err) {
      throw CairnError.from(err, 'summarizer');
    }
    return { usage, submission, lateError: null };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
