import { Worker, QueueBaseOptions } from 'bullmq';
import { ScrapeJobData } from './queue';
import { scrapeUrl, ProxyUnreachableError } from './scraper';

const connection: QueueBaseOptions['connection'] = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const concurrency = parseInt(process.env.MAX_CONCURRENCY || '3', 10);

function categorizeError(err: unknown): { statusCode: number; message: string } {
  if (err instanceof ProxyUnreachableError) {
    return { statusCode: 502, message: err.message };
  }
  const msg = err instanceof Error ? err.message : 'Unknown error';
  if (
    msg.toLowerCase().includes('timeout') ||
    msg.toLowerCase().includes('timed out')
  ) {
    return { statusCode: 504, message: 'Request timed out while scraping the URL' };
  }
  return { statusCode: 500, message: msg };
}

function checkWebhookScheme(url: string): void {
  if (url.startsWith('http://')) {
    console.warn(
      `⚠  Webhook URL uses unencrypted HTTP: ${url}. ` +
      'Payloads will be sent in plain text. Use HTTPS in production.',
    );
  } else if (!url.startsWith('https://')) {
    console.warn(`⚠  Webhook URL has unrecognized scheme: ${url}`);
  }
}

export function createWorker(): Worker {
  const worker = new Worker<ScrapeJobData>(
    'scrape-queue',
    async (job) => {
      const { url, selectors, webhookUrl, userId } = job.data;
      console.log(`Worker processing job ${job.id} (user ${userId}): ${url}`);

      const result = await scrapeUrl(url, selectors);

      if (webhookUrl) {
        checkWebhookScheme(webhookUrl);
        console.log(`Sending result to webhook: ${webhookUrl}`);
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, userId, ...result }),
          signal: AbortSignal.timeout(10_000),
        });
      }

      return { ...result, userId };
    },
    {
      connection,
      concurrency,
      lockDuration: 120_000,
    },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { webhookUrl, url, userId } = job.data;
    const { statusCode, message } = categorizeError(err);
    console.error(`Job ${job.id} (${url}, user ${userId}) failed [${statusCode}]:`, message);

    if (webhookUrl) {
      checkWebhookScheme(webhookUrl);
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            userId,
            url,
            error: message,
            statusCode,
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        console.error(`Failed to send error webhook for job ${job.id}`);
      }
    }
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  console.log(`BullMQ Worker started (concurrency=${concurrency})`);

  return worker;
}
