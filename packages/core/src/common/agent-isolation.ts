import type { Options } from '@anthropic-ai/claude-agent-sdk';

// allowedTools 는 '확인 없이 허용' 목록일 뿐 도구를 제한하지 않음 — 기본 도구(Bash·Read 등)가 남으면
// 입력(PR 본문 등)에 심은 지시로 로컬 파일·env 를 읽어 외부로 보냄. 넘긴 MCP 서버 외 전부 차단
export function isolatedAgentOptions(): Pick<
  Options,
  'tools' | 'settingSources' | 'strictMcpConfig'
> {
  return {
    tools: [],
    settingSources: [], // 사용자·프로젝트 settings 의 허용 규칙·CLAUDE.md 미적용
    strictMcpConfig: true, // claude.ai 커넥터·.mcp.json 등 외부 MCP 제외
  };
}
