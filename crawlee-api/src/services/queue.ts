import { Queue, QueueBaseOptions } from 'bullmq';

const connection: QueueBaseOptions['connection'] = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const scrapeQueue = new Queue('scrape-queue', { connection });

export interface ScrapeJobData {
  url: string;
  selectors?: string[];
  webhookUrl?: string;
  userId: string;
}

export async function addScrapeJob(data: ScrapeJobData): Promise<string> {
  const job = await scrapeQueue.add('scrape', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 86400, count: 1000 },
  });
  return job.id!;
}
