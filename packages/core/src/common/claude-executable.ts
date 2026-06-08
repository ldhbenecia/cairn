// 데스크톱이 해석해 넘긴 시스템 claude 경로. 번들 바이너리를 제거했으므로(ADR 0019)
// packaged 에선 이 값이 있어야 SDK 가 실행파일을 찾는다. dev 에선 미설정 시 built-in 폴백.
export function claudeExecutableOptions(): { pathToClaudeCodeExecutable?: string } {
  const p = process.env.CAIRN_CLAUDE_PATH;
  return p ? { pathToClaudeCodeExecutable: p } : {};
}
