import type { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';

// toNextJsHandler(auth) 는 모듈 로드 때 auth 를 건드려 지연 초기화를 무효화 — 요청 시점에 위임
const handler = (req: NextRequest): Promise<Response> => auth.handler(req);

export { handler as GET, handler as POST };
