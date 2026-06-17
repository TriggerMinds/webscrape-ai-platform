import { Router, Request, Response } from 'express';
import { scrapeUrl } from '../services/scraper';

export const scrapeRouter = Router();

interface ScrapeRequestBody {
  url?: string;
  selectors?: string[];
}

interface ErrorResponse {
  error: string;
  details?: string;
}

scrapeRouter.post('/scrape', async (req: Request, res: Response) => {
  const { url, selectors } = req.body as ScrapeRequestBody;

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

  try {
    const result = await scrapeUrl(url, selectors);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Scrape failed for "${url}":`, message);

    const isTimeout =
      message.toLowerCase().includes('timeout') ||
      message.toLowerCase().includes('timed out') ||
      message.toLowerCase().includes('navigation');

    const statusCode = isTimeout ? 504 : 500;
    const errResp: ErrorResponse = {
      error: isTimeout ? 'Request timed out while scraping the URL' : message,
    };
    res.status(statusCode).json(errResp);
  }
});
