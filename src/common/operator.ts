import { createHash } from 'node:crypto';

const OPERATOR_SECRET_HASH: string | null =
  'b6e23b5bdac3a730e57dc59de56afe86a984a8223cab7ac57e7e32b979616d97';

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
