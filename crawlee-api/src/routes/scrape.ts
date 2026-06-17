import { Router, Response } from 'express';
import { addScrapeJob } from '../services/queue';
import { getCachedResult } from '../services/cache';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../services/logger';

export const scrapeRouter = Router();

interface ScrapeRequestBody {
  url?: string;
  selectors?: string[];
  webhookUrl?: string;
}

scrapeRouter.post('/scrape', async (req: AuthenticatedRequest, res: Response) => {
  const { url, selectors, webhookUrl } = req.body as ScrapeRequestBody;
  const userId = req.userId!;

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    res.status(400).json({ error: 'Missing or invalid "url" in request body' });
    return;
  }

  if (selectors !== undefined && (!Array.isArray(selectors) || selectors.some((s) => typeof s !== 'string'))) {
    res.status(400).json({ error: '"selectors" must be an array of strings' });
    return;
  }

  if (webhookUrl !== undefined && typeof webhookUrl !== 'string') {
    res.status(400).json({ error: '"webhookUrl" must be a string' });
    return;
  }

  const trimmedUrl = url.trim();
  const trimmedSelectors = selectors?.map((s) => s.trim()).filter(Boolean);

  const cached = await getCachedResult(userId, trimmedUrl, trimmedSelectors);
  if (cached) {
    logger.info({ userId, url: trimmedUrl }, 'Cache hit — returning cached result');
    res.json({ cached: true, ...cached });
    return;
  }

  try {
    const jobId = await addScrapeJob({
      url: trimmedUrl,
      selectors: trimmedSelectors,
      webhookUrl,
      userId,
    });
    res.status(202).json({
      jobId,
      status: 'queued',
      userId,
      message: `Scrape job enqueued for ${trimmedUrl}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ userId, url: trimmedUrl, err: message }, 'Failed to enqueue scrape job');
    res.status(500).json({ error: 'Failed to enqueue scrape job' });
  }
});
