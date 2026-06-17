import { Request, Response, NextFunction } from 'express';
import { lookupApiKey } from '../services/db';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

const failedAuthAttempts = new Map<string, { count: number; resetAt: number }>();

function checkBruteForce(ip: string): boolean {
  const now = Date.now();
  const entry = failedAuthAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    failedAuthAttempts.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
    return false;
  }

  entry.count++;
  if (entry.count > 5) {
    return true;
  }
  return false;
}

function resetBruteForce(ip: string): void {
  failedAuthAttempts.delete(ip);
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  if (!apiKey) {
    res.status(401).json({ error: 'Missing x-api-key header' });
    return;
  }

  if (checkBruteForce(clientIp)) {
    console.warn(`Brute-force blocked for IP ${clientIp}`);
    res.status(429).json({ error: 'Too many failed authentication attempts. Try again later.' });
    return;
  }

  try {
    const keyData = await lookupApiKey(apiKey);
    if (!keyData) {
      res.status(401).json({ error: 'Invalid or inactive API key' });
      return;
    }
    resetBruteForce(clientIp);
    req.userId = keyData.userId;
    next();
  } catch (err) {
    console.error('Auth lookup error:', err);
    res.status(500).json({ error: 'Authentication service unavailable' });
  }
}
