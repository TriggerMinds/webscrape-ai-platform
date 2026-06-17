# WebScrape AI Platform

A self-hosted, production-ready AI web scraping and orchestration platform that replaces **Firecrawl**, **Octoparse**, and **Gumloop**. Built with **n8n**, **Crawlee/Playwright**, **Turndown**, **Redis** (BullMQ), and **PostgreSQL** (pgvector).

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Browser    │────▶│  Crawlee API     │◀────│   n8n            │
│  (Playwright)│     │  :3001           │     │  :5678           │
└──────┬───────┘     └───────┬──────────┘     └───────┬──────────┘
       │                     │     ▲                   │
       │ SOCKS5 Proxy        │  (queue)│               │ Async callback
       ▼                     ▼     │                   ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Hysteria    │     │    Redis     │     │  BullMQ Worker   │
│  127.0.0.1   │     │   :6379     │     │  (max 3 conc.)   │
│  :1080       │     │             │     │                  │
└──────────────┘     └──────────────┘     └────────┬─────────┘
                                                    │
                                                    ▼
                                          ┌──────────────────┐
                                          │   Turndown       │
                                          │   HTML → MD      │
                                          └──────────────────┘
```

## Features

- **Resilient Headless Scraping** — Crawlee/Playwright with anti-bot stealth, JS rendering, network idle waiting, and automatic retries (3 attempts)
- **LLM-Ready Markdown** — HTML auto-converted to clean Markdown via Turndown
- **AI Orchestration** — n8n with Advanced AI / LangChain nodes for summarization, extraction, and data pipelines
- **Async Queue Architecture** — BullMQ + Redis prevents browser overload; max 3 concurrent Chromium instances (configurable via `MAX_CONCURRENCY`)
- **Webhook Callbacks** — Scrape results are POSTed back to n8n when ready, enabling fully asynchronous workflows
- **SOCKS5 Proxy** — All Playwright traffic routes through a configurable proxy (default `socks5://127.0.0.1:1080`)
- **CSS Selector Extraction** — Scrape only the parts you need with optional CSS selectors
- **Rate Limited API** — 10 requests per minute per client to prevent overload
- **Timeout & Retry Handling** — Graceful degradation on slow or blocking targets (504 on timeout, retries before failure)
- **Dockerized** — Single `docker-compose up` to run the entire stack
- **PostgreSQL + pgvector** — Vector-ready for future RAG capabilities

## Quick Start

### Prerequisites

- Docker & Docker Compose v2
- Git

### 1. Start the system

```bash
docker compose up -d
```

This starts four services:

| Service | Port | Description |
|---------|------|-------------|
| **n8n** | `5678` | Workflow orchestrator with AI/LangChain nodes |
| **Crawlee API** | `3001` | Headless scraping microservice (BullMQ worker) |
| **Redis** | `6379` | Job queue for decoupled scraping |
| **PostgreSQL** | `5432` | Database with pgvector extension |

### 2. Configure n8n

1. Open `http://localhost:5678` in your browser
2. Complete the n8n setup wizard (create an account)
3. Set the `N8N_ENCRYPTION_KEY` environment variable in your `.env` file

### 3. Import the n8n workflow

1. In n8n, go to **Workflows** → **Add Workflow** → **Import from File**
2. Select `n8n-workflows/scrape-and-extract.json`
3. The workflow has two independent trigger paths:

**Part 1 — Queue trigger** (Webhook `/webhook/scrape-start`):
- Receives your URL payload
- Calls the Crawlee API with a `webhookUrl` pointing back to n8n
- Returns immediately (HTTP 202)

**Part 2 — Result handler** (Webhook `/webhook/scrape-result`):
- Called by the Crawlee worker when scraping completes
- **AI Extract (Mock)** — Code node that generates a summary and word count (replace with OpenAI/LangChain for real AI)
- **Store in PostgreSQL** — Upserts results into the `scraped_pages` table
- **Initialize DB Schema** — Run once to create the table and enable pgvector

4. Click **Save**, then **Active** to enable the workflow

### 4. Test the scraping API directly

```bash
curl -X POST http://localhost:3001/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

Response (202 Accepted):

```json
{
  "jobId": "abc123",
  "status": "queued",
  "message": "Scrape job enqueued for https://example.com"
}
```

With a webhook callback:

```bash
curl -X POST http://localhost:3001/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "webhookUrl": "https://my-server.com/callback"}'
```

### 5. Trigger the n8n workflow

```bash
curl -X POST http://localhost:5678/webhook/scrape-start \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

The workflow will:
1. Enqueue the scrape job in BullMQ (via Redis)
2. Return 202 immediately
3. The worker (max 3 concurrent) processes the URL
4. On completion, results are POSTed back to n8n's `/webhook/scrape-result`
5. n8n runs AI extraction and stores in PostgreSQL

## Environment Variables

Create a `.env` file in the project root:

```env
# Database
DB_USER=n8n
DB_PASSWORD=n8n_password
DB_NAME=n8n
DB_PORT=5432

# n8n
N8N_PORT=5678
N8N_WEBHOOK_URL=http://localhost:5678/
N8N_ENCRYPTION_KEY=your-random-32-char-key-here

# Crawlee API
CRAWLEE_PORT=3001
PROXY_URL=socks5://127.0.0.1:1080

# Redis & Queue
REDIS_HOST=redis
REDIS_PORT=6379
MAX_CONCURRENCY=3
```

**Redis note**: In Docker Compose, the `REDIS_HOST` defaults to the `redis` service name. For local development outside Docker, set `REDIS_HOST=127.0.0.1`.

## Project Structure

```
├── docker-compose.yml             # Stack orchestration (4 services)
├── .env                           # Environment configuration
├── .gitignore
├── AGENTS.md                      # Architecture conventions
├── crawlee-api/                   # Scraping microservice
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── .eslintrc.json
│   ├── .prettierrc
│   └── src/
│       ├── index.ts               # Express server + BullMQ worker init
│       ├── routes/
│       │   └── scrape.ts          # POST /api/scrape (enqueue job → 202)
│       └── services/
│           ├── queue.ts           # BullMQ queue (scrape-queue)
│           ├── worker.ts          # BullMQ worker (concurrency-limited)
│           └── scraper.ts         # PlaywrightCrawler + Turndown + retries
├── n8n-workflows/
│   └── scrape-and-extract.json    # Async two-part workflow
└── README.md
```

## Development

```bash
cd crawlee-api
npm install
npm run dev        # Hot-reload with tsx watch
npm run build      # Compile TypeScript
npm run lint       # ESLint check
npm run typecheck  # TypeScript type check
```

## API Reference

### `POST /api/scrape`

Enqueue a URL for scraping. Returns immediately with a `jobId`.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | `string` | Yes | The URL to scrape |
| `selectors` | `string[]` | No | Optional CSS selectors to extract specific elements |
| `webhookUrl` | `string` | No | URL to POST the result to when done |

**Response (202):**

```json
{
  "jobId": "abc123",
  "status": "queued",
  "message": "Scrape job enqueued for https://example.com"
}
```

**Webhook callback payload (POST to `webhookUrl`):**

Success:
```json
{
  "success": true,
  "url": "https://example.com",
  "title": "Example Domain",
  "rawHtml": "<html>...</html>",
  "markdown": "# Example Domain\n\nThis domain is for use..."
}
```

Failure:
```json
{
  "success": false,
  "url": "https://example.com",
  "error": "Failed to scrape after 3 retries"
}
```

**Error responses:**
- `400` — Missing or invalid URL
- `429` — Rate limit exceeded (max 10 req/min)
- `500` — Failed to enqueue job

### `GET /health`

Health check endpoint.

```json
{
  "status": "ok",
  "timestamp": "2026-06-17T12:00:00.000Z"
}
```

## AGENTS.md Requirements — Compliance Checklist

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Microservice Pattern | ✅ | Crawlee runs as standalone Express REST API, decoupled from n8n |
| Proxy & Stealth | ✅ | SOCKS5 proxy via `ProxyConfiguration`, `useFingerprints: true` |
| Anti-Bot & Dynamic Content | ✅ | `networkidle` wait, stealth fingerprints, JS rendering |
| Resilience | ✅ | 3 retries, timeout handling (30s nav, 60s handler), 504 on timeout |
| Dockerized Setup | ✅ | Single `docker-compose.yml` with n8n + PostgreSQL + Redis + Crawlee API |
| TypeScript | ✅ | Full TypeScript with strict mode |
| ESLint/Prettier | ✅ | Configured in `.eslintrc.json` and `.prettierrc` |
| Environment Variables | ✅ | All configurable via `.env` (PORT, PROXY_URL, DB, Redis) |

## Roadmap

- [x] Headless scraping with PlaywrightCrawler
- [x] Markdown extraction via Turndown
- [x] SOCKS5 proxy support
- [x] Docker Compose deployment
- [x] n8n workflow with AI extraction stub
- [x] Rate limiting & retry logic
- [x] BullMQ queue architecture (prevents browser OOM)
- [ ] Real OpenAI/LangChain integration in the n8n workflow
- [ ] pgvector RAG pipeline
- [ ] Web UI for managing scrape jobs

## License

MIT
