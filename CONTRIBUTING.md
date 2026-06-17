# Contributing to WebScrape AI Platform

Thank you for your interest in contributing! This project is a self-hosted AI web scraping and orchestration platform built with **Node.js/TypeScript**, **Docker**, **Playwright**, and **n8n**.

## Development Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose v2
- Git

### Local development

```bash
# 1. Clone the repository
git clone https://github.com/TriggerMinds/webscrape-ai-platform.git
cd webscrape-ai-platform

# 2. Start infrastructure (PostgreSQL + Redis)
docker compose up -d postgres redis

# 3. Install dependencies
cd crawlee-api
npm install

# 4. Copy environment config
cp .env.example .env
# Edit .env — set REDIS_HOST=127.0.0.1, DB_HOST=127.0.0.1 for local dev

# 5. Start the dev server (hot-reload)
npm run dev
```

### Running tests

```bash
cd crawlee-api
npm test           # Run once
npm run test:watch # Watch mode
```

### Code quality

```bash
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint (0 warnings required)
npm run format     # Prettier formatting
```

## Pull Request Process

1. **Fork** the repository and create your branch from `master`.
2. **Write tests** for any new functionality.
3. Ensure all existing and new tests pass (`npm test`).
4. Run `npm run typecheck` and `npm run lint` — both must pass with zero errors.
5. Update the README or relevant documentation if your change introduces new environment variables or behavioural changes.
6. Open a Pull Request with a clear title and description. Reference any related issues.

## Code Style

- TypeScript with strict mode
- ESLint + Prettier (auto-format before committing)
- Single quotes, trailing commas, 100 character print width
- Environment variables for all configurable parameters
- Pino structured logging (no `console.log`)

## Project Structure

```
crawlee-api/src/
├── index.ts          # Express server, auth, worker init
├── middleware/       # Express middleware (auth)
├── routes/           # API route handlers
└── services/         # Business logic (scraper, queue, worker, db, cache)
```

## Questions?

Open a [Discussion](https://github.com/TriggerMinds/webscrape-ai-platform/discussions) or an issue.
