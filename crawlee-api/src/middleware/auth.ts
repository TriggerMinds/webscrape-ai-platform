import { Request, Response, NextFunction } from 'express';
import { lookupApiKey } from '../services/db';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: 'Missing x-api-key header' });
    return;
  }

  try {
    const keyData = await lookupApiKey(apiKey);
    if (!keyData) {
      res.status(401).json({ error: 'Invalid or inactive API key' });
      return;
    }
    req.userId = keyData.userId;
    next();
  } catch (err) {
    console.error('Auth lookup error:', err);
    res.status(500).json({ error: 'Authentication service unavailable' });
  }
}
