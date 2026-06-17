import { createHmac } from 'node:crypto';
import { Worker, QueueBaseOptions } from 'bullmq';
import { ScrapeJobData } from './queue';
import { scrapeUrl, ProxyUnreachableError } from './scraper';
import { pool } from './db';
import { setCachedResult } from './cache';
import { logger } from './logger';

const connection: QueueBaseOptions['connection'] = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const concurrency = parseInt(process.env.MAX_CONCURRENCY || '3', 10);
const maxWebhookRetries = 3;
const webhookSecret = process.env.WEBHOOK_SECRET || '';

export function categorizeError(err: unknown): { statusCode: number; message: string } {
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
    logger.warn({ webhookUrl: url }, 'Webhook URL uses unencrypted HTTP — payload will be sent in plain text');
  } else if (!url.startsWith('https://')) {
    logger.warn({ webhookUrl: url }, 'Webhook URL has unrecognized scheme');
  }
}

function signPayload(payload: Record<string, unknown>): string {
  if (!webhookSecret) return '';
  const body = JSON.stringify(payload);
  return createHmac('sha256', webhookSecret).update(body).digest('hex');
}

async function deliverWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  checkWebhookScheme(webhookUrl);

  const signature = signPayload(payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (signature) {
    headers['x-webhook-signature'] = signature;
  }

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxWebhookRetries; attempt++) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxWebhookRetries) {
        const delay = Math.min(1000 * 2 ** attempt, 15_000);
        logger.warn(
          { webhookUrl, attempt, maxWebhookRetries, delay, err: lastErr.message },
          'Webhook delivery failed, retrying',
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(
    { webhookUrl, lastError: lastErr!.message },
    'DEAD LETTER — Webhook permanently failed after all retries',
  );
}

export function createWorker(): Worker {
  const worker = new Worker<ScrapeJobData>(
    'scrape-queue',
    async (job) => {
      const { url, selectors, webhookUrl, userId } = job.data;
      logger.info({ jobId: job.id, userId, url }, 'Worker processing job');

      const result = await scrapeUrl(url, selectors);

      try {
        await pool.query(
          `INSERT INTO scraped_pages (user_id, url, title, markdown, raw_html, word_count, processed_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            userId,
            result.url,
            result.title,
            result.markdown,
            result.rawHtml,
            result.markdown ? result.markdown.split(/\s+/).length : 0,
          ],
        );
      } catch (err) {
        logger.error(
          { jobId: job.id, userId, url, err: err instanceof Error ? err.message : String(err) },
          'Database insert failed — result still cached and deliverable via webhook',
        );
      }

      await setCachedResult(userId, url, result, selectors);

      if (webhookUrl) {
        await deliverWebhook(webhookUrl, { success: true, userId, ...result });
      }

      logger.info({ jobId: job.id, userId, url }, 'Job completed');
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

    logger.error(
      { jobId: job.id, userId, url, statusCode, err: message },
      'Job failed',
    );

    if (job.attemptsMade >= (job.opts?.attempts || 3)) {
      logger.error(
        { jobId: job.id, url, attempts: job.attemptsMade },
        'DEAD LETTER — Job exhausted all retries',
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
    logger.info({ jobId: job.id }, 'Job completed successfully');
  });

  logger.info({ concurrency }, 'BullMQ Worker started');

  return worker;
}
