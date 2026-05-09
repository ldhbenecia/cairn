import { createHash } from 'node:crypto';

const OPERATOR_SECRET_HASH: string | null = null;

let cached: boolean | undefined;

export function isOperator(): boolean {
  if (cached !== undefined) return cached;

  const secret = process.env.CAIRN_OPERATOR_SECRET;
  if (!secret || !OPERATOR_SECRET_HASH) {
    cached = false;
    return false;
  }

  const hash = createHash('sha256').update(secret).digest('hex');
  cached = hash === OPERATOR_SECRET_HASH;
  return cached;
}

export function resetOperatorCache(): void {
  cached = undefined;
}
