import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { ScrapeResult } from './scraper';

const CACHE_TTL_SEC = parseInt(process.env.CACHE_TTL || '86400', 10);

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
});

function cacheKey(userId: string, url: string, selectors?: string[]): string {
  const input = `${userId}:${url}:${JSON.stringify(selectors || [])}`;
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 16);
  return `cache:scrape:${hash}`;
}

export async function getCachedResult(
  userId: string,
  url: string,
  selectors?: string[],
): Promise<ScrapeResult | null> {
  try {
    const key = cacheKey(userId, url, selectors);
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as ScrapeResult;
  } catch {
    return null;
  }
}

export async function setCachedResult(
  userId: string,
  url: string,
  result: ScrapeResult,
  selectors?: string[],
): Promise<void> {
  try {
    const key = cacheKey(userId, url, selectors);
    await redis.setex(key, CACHE_TTL_SEC, JSON.stringify(result));
  } catch {
    // cache write failure is non-critical
  }
}
