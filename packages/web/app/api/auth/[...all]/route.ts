import type { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';

const handler = (req: NextRequest): Promise<Response> => auth.handler(req);

export { handler as GET, handler as POST };
