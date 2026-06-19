export type PromptMode = 'daily' | 'weekly' | 'monthly';

const MAX_CUSTOM_PROMPT_CHARS = 4000;

export function customPromptFor(mode: PromptMode): string | null {
  const raw = process.env[`CAIRN_PROMPT_${mode.toUpperCase()}`];
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_CUSTOM_PROMPT_CHARS);
}

export function withCustomPrompt(base: string, custom: string | null): string {
  if (!custom) return base;
  return [
    base,
    '',
    'User customization — the user wrote the following instructions. They take precedence over the style/emphasis guidance above, but the tool workflow (get_* then submit_* exactly once), the output schema, and the no-invention/no-sensitive-data rules are non-negotiable:',
    custom,
  ].join('\n');
}
