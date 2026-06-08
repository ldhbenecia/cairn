export function claudeExecutableOptions(): { pathToClaudeCodeExecutable?: string } {
  const p = process.env.CAIRN_CLAUDE_PATH;
  return p ? { pathToClaudeCodeExecutable: p } : {};
}
