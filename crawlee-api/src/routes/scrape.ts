import { Router, Request, Response } from 'express';
import { scrapeUrl } from '../services/scraper';

export const scrapeRouter = Router();

scrapeRouter.post('/scrape', async (req: Request, res: Response) => {
  try {
    const { url, selectors } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "url" in request body' });
      return;
    }

    const result = await scrapeUrl(url, selectors);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
