import { query } from '@anthropic-ai/claude-agent-sdk';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CairnError } from '../common/error.js';
import { isOperator } from '../common/operator.js';
import type { WorklogSummary, WorklogSummaryUsage } from '../contracts/worklog-summary.types.js';
import { buildSummarizerTools, type SummarizerInput } from './summarizer-tools.js';

const SYSTEM_PROMPT = [
  'You are cairn, a Korean worklog summarizer for a backend developer.',
  '',
  "Purpose: This worklog accumulates over months/years and will be used as raw material for the developer's resume, performance reviews, and retrospectives. Phrase bullets so they remain meaningful when read months later — emphasize the project, the meaningful unit of work, and outcome.",
  '',
  'Workflow:',
  "1. Call get_activity exactly once to retrieve today's data.",
  '2. Read the response (done / inProgress / notes / sourceErrors).',
  '3. Call submit_summary exactly once with a Korean summary.',
  '',
  'Output rules (strict):',
  '- Output language MUST be Korean.',
  '- paragraphKo: 1-3 short Korean sentences capturing the day theme at the project level. e.g. "cairn 의 단계 4 (Notion publisher) 마무리 + 단계 5 (Summarizer) 본격 구현. 0.5.x 일련의 운영 안정화 동반."',
  '- doneBullets: 3-10 phrases. Format: "[프로젝트명] 의미 있는 한국어 작업 단위". 프로젝트명은 repo 이름 (e.g. [cairn], [other-repo]). 같은 repo 의 관련 commits/PRs 를 의미 단위로 group. PR.body 가 있으면 그 안의 핵심 키워드 / 작업 사항을 반드시 활용해서 구체적으로 작성 (추상화로 정보 손실 방지).',
  '- inProgressBullets: same format as doneBullets, ongoing work.',
  '- notesBullets: Notion pages edited today, with Korean context. Format: "[Notion] 페이지 제목 — 짧은 컨텍스트".',
  '- Empty arrays are OK if no items in that category.',
  '',
  'Bullet examples (good vs bad):',
  '- BAD: "chore/license-agpl: 0.5.4 LICENSE 파일 추가"  (raw branch + commit subject)',
  '- BAD: "feat(notion): worklog DB schema 변경"          (technical prefix)',
  '- GOOD: "[cairn] 단계 4 Notion publisher 완성 — 자동 DB 생성 + 멱등 페이지 발행 (0.5.0)"',
  '- GOOD: "[cairn] 0.5.x 운영 안정화 — graceful fallback / typed CairnError / log 가독성 / 라이센스 정리"',
  '- GOOD: "[cairn] 단계 5 Summarizer 본격 구현 — claude-agent-sdk + sanitize + 운영자 차등"',
  '',
  'Style — STRICT:',
  '- Do NOT copy commit subjects verbatim. Synthesize.',
  '- Do NOT include branch names ("feature/xxx", "chore/xxx") or commit type prefixes ("feat(scope):", "chore(repo):").',
  '- Combine multiple related commits (one PR / a series of fixes / a feature group) into a single bullet.',
  '- Bullets are short noun-phrases / verb-noun phrases in Korean, not English-style full sentences.',
  '- Bullets should read well 6 months later — name the project, the work unit, and the outcome.',
  '',
  'Do not invent items. Only summarize what get_activity returned.',
  'Do not include code bodies, diffs, absolute file paths, or token strings.',
  'If sourceErrors are present, briefly mention them in paragraphKo.',
].join('\n');

const MCP_SERVER_NAME = 'cairn-summarizer';

@Injectable()
export class DailySummarizerService {
  constructor(
    @InjectPinoLogger(DailySummarizerService.name)
    private readonly logger: PinoLogger,
  ) {}

  async summarize(input: SummarizerInput): Promise<WorklogSummary | null> {
    const { server, getSubmission } = buildSummarizerTools(input);

    const userPrompt = `Summarize my work for ${input.date} (KST). Call get_activity, then submit_summary.`;

    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    let resultSubtype = 'unknown';

    try {
      const q = query({
        prompt: userPrompt,
        options: {
          systemPrompt: SYSTEM_PROMPT,
          mcpServers: {
            [MCP_SERVER_NAME]: server,
          },
          allowedTools: [
            `mcp__${MCP_SERVER_NAME}__get_activity`,
            `mcp__${MCP_SERVER_NAME}__submit_summary`,
          ],
          maxTurns: 5,
        },
      });

      for await (const message of q) {
        if (message.type === 'assistant') {
          const inner = (message as { message?: { usage?: unknown } }).message;
          if (inner?.usage && typeof inner.usage === 'object') {
            const u = inner.usage as { input_tokens?: number; output_tokens?: number };
            inputTokens += typeof u.input_tokens === 'number' ? u.input_tokens : 0;
            outputTokens += typeof u.output_tokens === 'number' ? u.output_tokens : 0;
          }
        } else if (message.type === 'result') {
          resultSubtype = message.subtype;
          if ('total_cost_usd' in message && typeof message.total_cost_usd === 'number') {
            costUsd = message.total_cost_usd;
          }
        }
      }
    } catch (err) {
      const error = CairnError.from(err, 'summarizer');
      this.logger.warn({ date: input.date, error }, 'summarizer threw — fallback');
      return null;
    }

    this.logger.info(
      {
        date: input.date,
        resultSubtype,
        inputTokens,
        outputTokens,
        costUsd,
        isOperator: isOperator(),
      },
      'summarizer finished',
    );

    if (resultSubtype !== 'success') {
      this.logger.warn({ date: input.date, resultSubtype }, 'summarizer non-success — fallback');
      return null;
    }

    const submission = getSubmission();
    if (!submission) {
      this.logger.warn({ date: input.date }, 'summarizer ended without submit_summary — fallback');
      return null;
    }

    const usage: WorklogSummaryUsage | undefined = isOperator()
      ? { inputTokens, outputTokens, costUsd }
      : undefined;

    return { ...submission, ...(usage ? { usage } : {}) };
  }
}
