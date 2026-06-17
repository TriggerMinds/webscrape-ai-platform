# WebScrape AI Platform

A self-hosted, production-ready AI web scraping and orchestration platform that replaces **Firecrawl**, **Octoparse**, and **Gumloop**. Built with **n8n**, **Crawlee/Playwright**, **Turndown**, and **PostgreSQL** (pgvector).

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Browser    │────▶│  Crawlee API     │────▶│   n8n            │
│  (Playwright)│     │  :3001           │     │  :5678           │
└──────┬───────┘     └──────────────────┘     └───────┬──────────┘
       │                     │                        │
       │ SOCKS5 Proxy        │ POST /api/scrape       │ LangChain / AI
       ▼                     ▼                        ▼
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Hysteria    │     │   Turndown       │     │   PostgreSQL     │
│  127.0.0.1   │     │   HTML → MD      │     │   :5432          │
│  :1080       │     │                  │     │   (pgvector)     │
└──────────────┘     └──────────────────┘     └──────────────────┘
```

## Features

- **Resilient Headless Scraping** — Crawlee/Playwright with anti-bot stealth, JS rendering, network idle waiting, and automatic retries (3 attempts)
- **LLM-Ready Markdown** — HTML auto-converted to clean Markdown via Turndown
- **AI Orchestration** — n8n with Advanced AI / LangChain nodes for summarization, extraction, and data pipelines
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

This starts three services:

| Service | Port | Description |
|---------|------|-------------|
| **n8n** | `5678` | Workflow orchestrator with AI/LangChain nodes |
| **Crawlee API** | `3001` | Headless scraping microservice |
| **PostgreSQL** | `5432` | Database with pgvector extension |

### 2. Configure n8n

1. Open `http://localhost:5678` in your browser
2. Complete the n8n setup wizard (create an account)
3. Set the `N8N_ENCRYPTION_KEY` environment variable in your `.env` file

### 3. Import the n8n workflow

1. In n8n, go to **Workflows** → **Add Workflow** → **Import from File**
2. Select `n8n-workflows/scrape-and-extract.json`
3. The workflow contains these nodes:
   - **Webhook** — receives POST requests at `/webhook/scrape-start`
   - **Scrape URL** — calls the Crawlee API (`/api/scrape`)
   - **AI Extract (Mock)** — a Code node that generates a summary and word count (replace with OpenAI/LangChain for real AI)
   - **Store in PostgreSQL** — upserts results into the `scraped_pages` table
   - **Initialize DB Schema** — run once to create the table and enable pgvector
4. Click **Save**, then **Active** to enable the workflow

### 4. Test the scraping API directly

```bash
curl -X POST http://localhost:3001/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

Response:

```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "rawHtml": "<html>...</html>",
  "markdown": "# Example Domain\n\nThis domain is for use..."
}
```

With CSS selectors:

```bash
curl -X POST http://localhost:3001/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "selectors": ["h1", "p"]}'
```

### 5. Trigger the n8n workflow

```bash
curl -X POST http://localhost:5678/webhook/scrape-start \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

The workflow will scrape the URL, process the result, and store it in PostgreSQL.

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
```

## Project Structure

```
├── docker-compose.yml             # Stack orchestration
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
│       ├── index.ts               # Express server with rate limiting
│       ├── routes/
│       │   └── scrape.ts          # POST /api/scrape endpoint
│       └── services/
│           └── scraper.ts         # PlaywrightCrawler + Turndown + retries
├── n8n-workflows/
│   └── scrape-and-extract.json    # Webhook → Scrape → AI → PostgreSQL
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

Scrape a URL and return Markdown.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | `string` | Yes | The URL to scrape |
| `selectors` | `string[]` | No | Optional CSS selectors to extract specific elements |

**Response (200):**

```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "rawHtml": "<html>...</html>",
  "markdown": "# Example Domain\n\nThis domain is for use..."
}
```

**Error responses:**
- `400` — Missing or invalid URL
- `429` — Rate limit exceeded (max 10 req/min)
- `500` — Scraping failed
- `504` — Request timed out

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
| Dockerized Setup | ✅ | Single `docker-compose.yml` with n8n + PostgreSQL + Crawlee API |
| TypeScript | ✅ | Full TypeScript with strict mode |
| ESLint/Prettier | ✅ | Configured in `.eslintrc.json` and `.prettierrc` |
| Environment Variables | ✅ | All configurable via `.env` (PORT, PROXY_URL, DB credentials) |

## Roadmap

- [x] Headless scraping with PlaywrightCrawler
- [x] Markdown extraction via Turndown
- [x] SOCKS5 proxy support
- [x] Docker Compose deployment
- [x] n8n workflow with AI extraction stub
- [x] Rate limiting & retry logic
- [ ] Real OpenAI/LangChain integration in the n8n workflow
- [ ] pgvector RAG pipeline
- [ ] Web UI for managing scrape jobs

## License

MIT
