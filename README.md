# WebScrape AI Platform

A self-hosted, production-ready, **multi-tenant** AI web scraping and orchestration platform that replaces **Firecrawl**, **Octoparse**, and **Gumloop**. Built with **n8n**, **Crawlee/Playwright**, **Turndown**, **Redis** (BullMQ), and **PostgreSQL** (pgvector).

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
                           ▲                        │
                           │                        ▼
                     ┌─────┴─────┐          ┌──────────────────┐
                     │ PostgreSQL│◀─────────│   Turndown       │
                     │  :5432    │          │   HTML → MD      │
                     │           │          └──────────────────┘
                     │ api_keys  │
                     │ scraped   │
                     │ _pages    │
                     └───────────┘
```

## Features

- **Multi-Tenant** — API key authentication, per-user data isolation, per-user rate limiting (10 req/min)
- **Resilient Headless Scraping** — Crawlee/Playwright with anti-bot stealth, JS rendering, network idle waiting, and automatic retries (3 attempts)
- **LLM-Ready Markdown** — HTML auto-converted to clean Markdown via Turndown
- **AI Orchestration** — n8n with Advanced AI / LangChain nodes for summarization, extraction, and data pipelines
- **Async Queue Architecture** — BullMQ + Redis prevents browser overload; max 3 concurrent Chromium instances
- **Webhook Callbacks** — Scrape results are POSTed back when ready
- **SOCKS5 Proxy** — All Playwright traffic routes through a configurable proxy (default `socks5://127.0.0.1:1080`)
- **Dockerized** — Single `docker-compose up` to run the entire stack

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
| **PostgreSQL** | `5432` | Database with pgvector + api_keys + scraped_pages |

### 2. Create an API key

The first time the Crawlee API starts, it auto-creates the database tables. To add an API key, run this SQL against PostgreSQL:

```bash
docker compose exec postgres psql -U n8n -d n8n -c "
INSERT INTO api_keys (key_value, user_id, name)
VALUES ('wsp_demo_key_123', 'user_demo', 'Demo User')
ON CONFLICT (key_value) DO NOTHING;
"
```

Or connect with any PostgreSQL client and insert a row into the `api_keys` table:

| Column | Value |
|--------|-------|
| `key_value` | Your API key (e.g. `wsp_abc123`) |
| `user_id` | Unique user identifier (e.g. `user_42`) |
| `name` | Human-readable name |
| `is_active` | `true` (set to `false` to disable) |

### 3. Configure n8n

1. Open `http://localhost:5678` in your browser
2. Complete the n8n setup wizard (create an account)
3. Set the `N8N_ENCRYPTION_KEY` environment variable in your `.env` file

### 4. Import the n8n workflow

1. In n8n, go to **Workflows** → **Add Workflow** → **Import from File**
2. Select `n8n-workflows/scrape-and-extract.json`
3. The workflow has two independent trigger paths:

**Part 1 — Queue trigger** (Webhook `/webhook/scrape-start`):
- Receives `{ "url": "...", "apiKey": "..." }`
- Calls the Crawlee API with the API key in the `x-api-key` header
- Passes a `webhookUrl` pointing back to n8n
- Returns immediately (HTTP 202)

**Part 2 — Result handler** (Webhook `/webhook/scrape-result`):
- Called by the Crawlee worker when scraping completes
- Receives `{ userId, url, title, markdown, ... }`
- **AI Extract (Mock)** — Generates summary and word count (replace with OpenAI/LangChain)
- **Store in PostgreSQL** — Inserts into `scraped_pages` (scoped by `user_id`)
- **Initialize DB Schema** — Run once to create all tables

4. Click **Save**, then **Active** to enable the workflow

### 5. Test the scraping API

```bash
curl -X POST http://localhost:3001/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-api-key: wsp_demo_key_123" \
  -d '{"url": "https://example.com"}'
```

Response (202 Accepted):

```json
{
  "jobId": "abc123",
  "status": "queued",
  "userId": "user_demo",
  "message": "Scrape job enqueued for https://example.com"
}
```

### 6. Trigger the n8n workflow

```bash
curl -X POST http://localhost:5678/webhook/scrape-start \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "apiKey": "wsp_demo_key_123"}'
```

The workflow will:
1. Enqueue the scrape job in BullMQ (with API key in header)
2. Return 202 immediately
3. The worker (max 3 concurrent) processes the URL
4. On completion, results are POSTed to n8n's `/webhook/scrape-result`
5. n8n runs AI extraction and stores in PostgreSQL (scoped to your user)

## Multi-Tenant Administration

### Creating API keys

As a community administrator, generate unique API keys for each user:

```sql
-- Using docker compose exec:
docker compose exec postgres psql -U n8n -d n8n -c "
INSERT INTO api_keys (key_value, user_id, name)
VALUES ('wsp_' || substr(md5(random()::text), 1, 16), 'user_2', 'Alice');
"
```

The `api_keys` table:

| Column | Description |
|--------|-------------|
| `key_value` | The API key sent in the `x-api-key` header |
| `user_id` | Internal user identifier for data isolation |
| `name` | Display name for admin reference |
| `is_active` | Set to `false` to revoke access |

### Data isolation

Every row in `scraped_pages` is tagged with `user_id`. The Crawlee worker includes `userId` in webhook callbacks. The n8n workflow stores this value alongside each record. Queries must always filter by `user_id` to prevent cross-tenant data leaks.

### Disabling a user

```sql
UPDATE api_keys SET is_active = false WHERE user_id = 'user_2';
```

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

**Service hostnames inside Docker**: `postgres`, `redis`, `crawlee-api`. For local development, use `127.0.0.1` for all.

## Project Structure

```
├── docker-compose.yml             # Stack orchestration (4 services)
├── .env
├── AGENTS.md
├── crawlee-api/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts               # Express + auth middleware + worker
│       ├── middleware/
│       │   └── auth.ts            # x-api-key validation → req.userId
│       ├── routes/
│       │   └── scrape.ts          # POST /api/scrape (auth required)
│       └── services/
│           ├── db.ts              # PostgreSQL pool + schema + key lookup
│           ├── queue.ts           # BullMQ queue (scrape-queue)
│           ├── worker.ts          # BullMQ worker (concurrency-limited)
│           └── scraper.ts         # PlaywrightCrawler + Turndown
├── n8n-workflows/
│   └── scrape-and-extract.json    # Async multi-tenant workflow
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

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `x-api-key` | Yes | API key from the `api_keys` table |
| `Content-Type` | Yes | `application/json` |

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | `string` | Yes | The URL to scrape |
| `selectors` | `string[]` | No | Optional CSS selectors |
| `webhookUrl` | `string` | No | URL to POST result to when done |

**Response (202):**

```json
{
  "jobId": "abc123",
  "status": "queued",
  "userId": "user_demo",
  "message": "Scrape job enqueued for https://example.com"
}
```

**Webhook callback payload (success):**

```json
{
  "success": true,
  "userId": "user_demo",
  "url": "https://example.com",
  "title": "Example Domain",
  "rawHtml": "<html>...</html>",
  "markdown": "# Example Domain\n\nThis domain is for use..."
}
```

**Error responses:**
- `401` — Missing or invalid API key
- `429` — Per-user rate limit exceeded (10 req/min)
- `400` — Missing or invalid URL
- `500` — Failed to enqueue job

### `GET /health`

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
| Environment Variables | ✅ | All configurable via `.env` |

## Roadmap

- [x] Headless scraping with PlaywrightCrawler
- [x] Markdown extraction via Turndown
- [x] SOCKS5 proxy support
- [x] Docker Compose deployment
- [x] n8n workflow with AI extraction stub
- [x] Rate limiting & retry logic
- [x] BullMQ queue architecture (prevents browser OOM)
- [x] Multi-tenant: API key auth, data isolation, per-user rate limits
- [ ] Real OpenAI/LangChain integration in the n8n workflow
- [ ] pgvector RAG pipeline
- [ ] Web UI for managing API keys and jobs

## License

MIT
