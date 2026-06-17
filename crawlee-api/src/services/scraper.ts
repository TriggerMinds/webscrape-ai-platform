import { PlaywrightCrawler, Dataset, ProxyConfiguration } from 'crawlee';
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

function sanitizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export async function scrapeUrl(url: string, selectors?: string[]): Promise<ScrapeResult> {
  const sanitizedUrl = sanitizeUrl(url);
  const proxyUrl = process.env.PROXY_URL || 'socks5://127.0.0.1:1080';

  const crawler = new PlaywrightCrawler({
    proxyConfiguration: new ProxyConfiguration({
      proxyUrls: [proxyUrl],
    }),
    launchContext: {
      launchOptions: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    },
    browserPoolOptions: {
      useFingerprints: true,
    },
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 60,
    navigationTimeoutSecs: 30,
    preNavigationHooks: [
      async (_ctx, goToOptions) => {
        goToOptions.waitUntil = 'networkidle';
        goToOptions.timeout = 30_000;
      },
    ],
    failedRequestHandler: async ({ request, log }) => {
      log.warning(`Request failed after ${request.retryCount} retries: ${request.url}`);
      throw new Error(
        `Failed to scrape ${request.url} after ${request.retryCount} retries`,
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

      await Dataset.pushData({
        url: request.loadedUrl || sanitizedUrl,
        title,
        rawHtml,
        markdown,
      });
    },
  });

  await crawler.run([sanitizedUrl]);

  const dataset = await Dataset.open();
  const { items } = await dataset.getData();

  if (!items || items.length === 0) {
    throw new Error('No data scraped from the URL');
  }

  const item = items[0] as unknown as ScrapeResult;

  return {
    url: item.url || sanitizedUrl,
    title: item.title || '',
    rawHtml: item.rawHtml || '',
    markdown: item.markdown || '',
  };
}
