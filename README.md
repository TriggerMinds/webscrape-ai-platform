# Firecrawl / Octoparse / Gumloop Alternative — AI Web Scraping & Orchestration Platform

A self-hosted, production-ready AI web scraping and orchestration platform that replaces **Firecrawl**, **Octoparse**, and **Gumloop**. Built with **n8n**, **Crawlee/Playwright**, **Turndown**, and **PostgreSQL**.

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Browser    │────▶│  Crawlee API     │────▶│   n8n       │
│  (Playwright)│     │  (Express/Fastify)│     │  Workflows  │
└──────────────┘     └──────────────────┘     └──────┬──────┘
       │                     │                       │
       │ SOCKS5 Proxy        │ POST /api/scrape      │ LangChain / AI
       ▼                     ▼                       ▼
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Hysteria    │     │   Turndown       │     │ PostgreSQL  │
│  127.0.0.1   │     │   HTML → MD      │     │ (pgvector)  │
│  :1080       │     │                  │     │             │
└──────────────┘     └──────────────────┘     └─────────────┘
```

## Features

- **Resilient Headless Scraping** — Crawlee/Playwright with anti-bot stealth, JS rendering, network idle waiting
- **LLM-Ready Markdown** — HTML auto-converted to clean Markdown via Turndown
- **AI Orchestration** — n8n with Advanced AI / LangChain nodes for summarization, extraction, and data pipelines
- **SOCKS5 Proxy Support** — All traffic routes through a configurable proxy (default `socks5://127.0.0.1:1080`)
- **CSS Selector Extraction** — Scrape only the parts you need with optional CSS selectors
- **Dockerized** — Single `docker-compose up` to run the entire stack
- **PostgreSQL + pgvector** — Vector-ready for future RAG capabilities

## Services

| Service | Port | Description |
|---------|------|-------------|
| **n8n** | `5678` | Workflow orchestrator with AI nodes |
| **Crawlee API** | `3001` | Headless scraping microservice |
| **PostgreSQL** | `5432` | Database (pgvector enabled) |

## Quick Start

### Prerequisites

- Docker & Docker Compose v2
- Git

### 1. Clone and start

```bash
git clone <your-repo-url>
cd <project-folder>
docker compose up -d
```

### 2. Set up n8n

1. Open `http://localhost:5678` in your browser
2. Set up your n8n account
3. Set the required environment variable `N8N_ENCRYPTION_KEY` in your `.env` file
4. Import the workflow from `n8n-workflows/scrape-and-extract.json`
5. Run the **Initialize DB Schema** node in the workflow (or run the SQL manually) to create the `scraped_pages` table

### 3. Scrape a URL via the API

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

### 4. Import the n8n workflow

1. In n8n, go to **Workflows** → **Import from File**
2. Select `n8n-workflows/scrape-and-extract.json`
3. The workflow includes a **Code** node as a mock AI extractor — replace it with an OpenAI/LangChain node for real summarization
4. Activate the workflow

### 5. Trigger a scrape

```bash
curl -X POST http://localhost:5678/webhook/scrape-start \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
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
```

## Project Structure

```
├── docker-compose.yml          # Stack orchestration
├── .env                        # Environment configuration
├── crawlee-api/                # Scraping microservice
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Express server entry
│       ├── routes/
│       │   └── scrape.ts       # POST /api/scrape endpoint
│       └── services/
│           └── scraper.ts      # PlaywrightCrawler + Turndown
├── n8n-workflows/              # Exported n8n workflow JSON files
│   └── scrape-and-extract.json # Webhook → Scrape → AI → PostgreSQL
└── AGENTS.md                   # Architecture conventions
```

## Development

```bash
cd crawlee-api
npm install
npm run dev      # Hot-reload with tsx watch
npm run build    # Compile TypeScript
npm run lint     # ESLint check
npm run typecheck
```

## Roadmap

- [x] Headless scraping with PlaywrightCrawler
- [x] Markdown extraction via Turndown
- [x] SOCKS5 proxy support
- [x] Docker Compose deployment
- [ ] n8n workflow example with AI summarization
- [ ] Rate limiting & retry logic
- [ ] pgvector RAG pipeline integration

## License

MIT
