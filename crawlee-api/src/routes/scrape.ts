import { Router, Response } from 'express';
import { addScrapeJob } from '../services/queue';
import { AuthenticatedRequest } from '../middleware/auth';

export const scrapeRouter = Router();

interface ScrapeRequestBody {
  url?: string;
  selectors?: string[];
  webhookUrl?: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

scrapeRouter.post('/scrape', async (req: AuthenticatedRequest, res: Response) => {
  const { url, selectors, webhookUrl } = req.body as ScrapeRequestBody;
  const userId = req.userId!;

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    const errResp: ErrorResponse = { error: 'Missing or invalid "url" in request body' };
    res.status(400).json(errResp);
    return;
  }

  if (selectors !== undefined && (!Array.isArray(selectors) || selectors.some((s) => typeof s !== 'string'))) {
    const errResp: ErrorResponse = { error: '"selectors" must be an array of strings' };
    res.status(400).json(errResp);
    return;
  }

  if (webhookUrl !== undefined && typeof webhookUrl !== 'string') {
    const errResp: ErrorResponse = { error: '"webhookUrl" must be a string' };
    res.status(400).json(errResp);
    return;
  }

  try {
    const jobId = await addScrapeJob({ url: url.trim(), selectors, webhookUrl, userId });
    res.status(202).json({
      jobId,
      status: 'queued',
      userId,
      message: `Scrape job enqueued for ${url}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Failed to enqueue scrape job for "${url}":`, message);
    res.status(500).json({ error: 'Failed to enqueue scrape job' });
  }
});
