import { Worker, QueueBaseOptions } from 'bullmq';
import { ScrapeJobData, scrapeQueue } from './queue';
import { scrapeUrl, ProxyUnreachableError } from './scraper';

const connection: QueueBaseOptions['connection'] = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const concurrency = parseInt(process.env.MAX_CONCURRENCY || '3', 10);
const maxWebhookRetries = 3;

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

async function deliverWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  checkWebhookScheme(webhookUrl);

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxWebhookRetries; attempt++) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxWebhookRetries) {
        const delay = Math.min(1000 * 2 ** attempt, 15_000);
        console.warn(
          `Webhook delivery attempt ${attempt}/${maxWebhookRetries} failed for ${webhookUrl}. ` +
          `Retrying in ${delay}ms... Error: ${lastErr.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(
    `⚠  DEAD LETTER — Webhook permanently failed after ${maxWebhookRetries} attempts: ${webhookUrl}. ` +
    `Last error: ${lastErr!.message}. The scrape result is stored in the database but was NOT delivered.`,
  );
}

export function createWorker(): Worker {
  const worker = new Worker<ScrapeJobData>(
    'scrape-queue',
    async (job) => {
      const { url, selectors, webhookUrl, userId } = job.data;
      console.log(`Worker processing job ${job.id} (user ${userId}): ${url}`);

      const result = await scrapeUrl(url, selectors);

      if (webhookUrl) {
        console.log(`Delivering result to webhook: ${webhookUrl}`);
        await deliverWebhook(webhookUrl, { success: true, userId, ...result });
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

    if (job.attemptsMade >= (job.opts?.attempts || 3)) {
      console.error(
        `⚠  DEAD LETTER — Job ${job.id} (${url}) exhausted all ${job.attemptsMade} retries. ` +
        `No further attempts will be made.`,
      );
    }

    if (webhookUrl) {
      await deliverWebhook(webhookUrl, {
        success: false,
        userId,
        url,
        error: message,
        statusCode,
      });
    }
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  process.on('SIGTERM', async () => {
    await worker.close();
  });

  console.log(`BullMQ Worker started (concurrency=${concurrency})`);

  return worker;
}
