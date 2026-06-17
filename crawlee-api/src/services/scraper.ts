import { PlaywrightCrawler, ProxyConfiguration } from 'crawlee';
import TurndownService from 'turndown';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

export interface ScrapeResult {
  url: string;
  title: string;
  rawHtml: string;
  markdown: string;
}

export class ProxyUnreachableError extends Error {
  constructor(proxyUrl: string) {
    super(`SOCKS5 Proxy onbereikbaar: ${proxyUrl}`);
    this.name = 'ProxyUnreachableError';
  }
}

export class ScrapeFailedError extends Error {
  constructor(url: string, reason: string) {
    super(`Failed to scrape ${url}: ${reason}`);
    this.name = 'ScrapeFailedError';
  }
}

function sanitizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

async function testProxyConnection(proxyUrl: string): Promise<void> {
  if (!proxyUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch('http://httpbin.org/ip', {
      signal: controller.signal,
      headers: { 'User-Agent': 'curl/8.0' },
    } as RequestInit & { signal: AbortSignal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch {
    clearTimeout(timeout);
    throw new ProxyUnreachableError(proxyUrl);
  } finally {
    clearTimeout(timeout);
  }
}

export async function scrapeUrl(url: string, selectors?: string[]): Promise<ScrapeResult> {
  const sanitizedUrl = sanitizeUrl(url);
  const proxyUrl = process.env.PROXY_URL || 'socks5://127.0.0.1:1080';

  await testProxyConnection(proxyUrl);

  let capturedResult: ScrapeResult | null = null;

  const crawler = new PlaywrightCrawler({
    proxyConfiguration: proxyUrl
      ? new ProxyConfiguration({ proxyUrls: [proxyUrl] })
      : undefined,
    launchContext: {
      launchOptions: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
        ],
      },
    },
    browserPoolOptions: {
      useFingerprints: true,
      closeInactiveBrowserAfterSecs: 30_000,
    },
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 60,
    navigationTimeoutSecs: 15,
    preNavigationHooks: [
      async (_ctx, goToOptions) => {
        goToOptions.waitUntil = 'networkidle';
        goToOptions.timeout = 30_000;
      },
    ],
    postNavigationHooks: [
      async (ctx) => {
        await ctx.page.close();
      },
    ],
    failedRequestHandler: async ({ request }) => {
      throw new ScrapeFailedError(
        request.url,
        `failed after ${request.retryCount} retries`,
      );
    },
    requestHandler: async (ctx) => {
      const { page, request } = ctx;

      try {
        await page.waitForLoadState('networkidle', { timeout: 30_000 });
      } catch {
        await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
      }
      await page.waitForTimeout(1000);

      const title = await page.title();
      let rawHtml: string;

      if (selectors && selectors.length > 0) {
        const parts: string[] = [];
        for (const sel of selectors) {
          const handles = await page.$$(sel);
          for (const h of handles) {
            const html = await h.innerHTML();
            parts.push(html);
          }
        }
        rawHtml = parts.join('\n');
      } else {
        rawHtml = await page.content();
      }

      const markdown = turndownService.turndown(rawHtml);

      capturedResult = {
        url: request.loadedUrl || sanitizedUrl,
        title,
        rawHtml,
        markdown,
      };
    },
  });

  try {
    await crawler.run([sanitizedUrl]);
  } finally {
    await crawler.teardown();
  }

  if (!capturedResult) {
    throw new ScrapeFailedError(sanitizedUrl, 'no data returned from request handler');
  }

  return capturedResult;
}
