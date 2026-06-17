# Project Goal
Build a self-hosted, integrated AI web scraping and orchestration platform that replaces Firecrawl, Octoparse, and Gumloop. The system will combine visual workflow orchestration (n8n), resilient headless scraping (Crawlee/Playwright), LLM-ready markdown extraction (Turndown), and AI agent processing.

# Architecture & Stack
- **Orchestrator & AI Engine**: n8n (Docker-based) using Advanced AI / LangChain nodes.
- **Scraping Engine**: A custom Node.js/TypeScript microservice using Crawlee (PlaywrightCrawler) exposed via an Express/Fastify API.
- **Data Conversion**: Turndown to convert HTML/DOM elements into clean Markdown (replicating Firecrawl).
- **Database**: PostgreSQL (with pgvector for potential RAG capabilities).

# Production Requirements
1. **Microservice Pattern**: Crawlee MUST be decoupled from n8n. It should run as an independent REST API that n8n calls via HTTP Request nodes.
2. **Proxy & Stealth**: All Playwright contexts in Crawlee must route traffic through a SOCKS5 proxy (defaulting to 127.0.0.1:1080 to comply with Hysteria stealth protocol). Use Crawlee's proxy configuration features.
3. **Anti-Bot & Dynamic Content**: Playwright must be configured to bypass basic bot protection (use Crawlee's stealth features) and wait for network idle/JS rendering before extracting content.
4. **Resilience**: The scraping API must handle timeouts, retries, and return structured JSON responses containing both raw data and the converted Markdown.
5. **Dockerized Setup**: The entire solution must be deployable via a single `docker-compose.yml` (n8n + PostgreSQL + Crawlee Microservice).

# Coding Conventions
- Use TypeScript for the Crawlee microservice.
- Strict ESLint/Prettier formatting.
- Environment variables for all configurable parameters (Proxy URL, Ports, DB Credentials).
