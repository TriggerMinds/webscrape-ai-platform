# Changelog

All notable changes to the WebScrape AI Platform will be documented in this file.

## [1.0.0] — 2026-06-17

Initial public release — a self-hosted, multi-tenant AI web scraping and orchestration platform.

### Added

- **Headless scraping engine** — PlaywrightCrawler with stealth fingerprinting, JS rendering, `networkidle` waits, and automatic retries (×3)
- **LLM-ready Markdown extraction** — Raw HTML → clean Markdown via Turndown, ready for GPT/Claude/LangChain
- **Async BullMQ queue** — Redis-backed job queue prevents Chromium OOM crashes; configurable concurrency (`MAX_CONCURRENCY`)
- **Multi-tenant API** — SHA-256 hashed API keys, per-user data isolation (`user_id` on every row), per-user rate limiting (10 req/min)
- **Webhook callbacks** — Submit a URL, receive result at your webhook when ready; exponential backoff retry (×3) + Dead Letter Queue logging
- **Webhook HMAC signing** — `x-webhook-signature` header with `WEBHOOK_SECRET` for origin verification
- **Redis result caching** — 24h TTL cache per user+URL; cache hit bypasses the queue entirely
- **Express API** — Helmet security headers, CORS, rate limiting, structured error codes (400/401/429/500/502/504)
- **Brute-force protection** — IP-based, 5 failed auth attempts per 15 minutes
- **Bull Board dashboard** — Live queue monitoring at `/admin/queues` (behind API key auth)
- **n8n integration** — Importable async workflow: webhook trigger → scrape → AI extract → PostgreSQL
- **SOCKS5 proxy support** — Configurable proxy; optional (can run without one); Cloudflare WARP guide included
- **Database migrations** — Tracked via `_migrations` table, auto-run on startup
- **Structured logging** — Pino with JSON output, dev-mode pretty-printing, API key redaction
- **Docker Compose deploy** — One-command `docker compose up -d`, includes n8n + PostgreSQL (pgvector) + Redis + Crawlee API
- **Resource limits** — CPU/memory caps on all containers, JSON-file logging with rotation
- **CI/CD** — GitHub Actions workflow: TypeScript type checking + ESLint on every PR
- **Playwright official image** — `mcr.microsoft.com/playwright` base, non-root user, no missing dependencies
- **Unit tests** — Vitest with 16 tests covering error categorisation, URL sanitisation, and API key hashing

### Security

- API keys stored as SHA-256 hashes (never plain text)
- Helmet security headers
- Brute-force prevention on auth
- Webhook HMAC signature verification
- `.env.example` with clear documentation of all secrets
