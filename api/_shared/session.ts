import type { VercelRequest, VercelResponse } from '@vercel/node';

const sessions = new Map<string, { userId: string; expires: number }>();

export function setSession(req: VercelRequest, res: VercelResponse, userId: string) {
  const sessionId = req.headers['x-session-id'] as string || Math.random().toString(36).substring(2, 15);
  const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  sessions.set(sessionId, { userId, expires });
  res.setHeader('X-Session-Id', sessionId);
  return sessionId;
}

export function getSession(req: VercelRequest): { userId?: string } {
  const sessionId = req.headers['x-session-id'] as string;
  const sessionData = sessions.get(sessionId);
  if (sessionData && sessionData.expires > Date.now()) {
    return { userId: sessionData.userId };
  }
  sessions.delete(sessionId);
  return {};
}

export function destroySession(req: VercelRequest) {
  const sessionId = req.headers['x-session-id'] as string;
  sessions.delete(sessionId);
}
