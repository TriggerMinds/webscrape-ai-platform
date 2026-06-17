# Security Policy

## Reporting a Vulnerability

We take the security of the WebScrape AI Platform seriously. If you discover a
security vulnerability, **please do NOT open a public issue**.

Instead, report it privately by emailing the maintainers or opening a
[security advisory](https://github.com/TriggerMinds/webscrape-ai-platform/security/advisories/new).

### What to include

- A brief description of the vulnerability
- Steps to reproduce (proof of concept)
- Affected versions
- Any potential impact

### Response timeline

- **24 hours**: Acknowledgment of receipt
- **7 days**: Initial assessment and mitigation plan
- **30 days**: Patch release or coordinated disclosure

## Scope

The following are in scope:

- The `crawlee-api` Node.js/TypeScript microservice
- Docker Compose configuration
- n8n workflow exports
- Database schema and migrations

Out of scope:

- Third-party services (n8n, PostgreSQL, Redis) — report to their respective projects
- General Docker security — refer to Docker's documentation

## Best Practices

When deploying in production:

1. Set a strong `N8N_ENCRYPTION_KEY` and `WEBHOOK_SECRET`
2. Use HTTPS behind a reverse proxy (Traefik, Nginx, Caddy)
3. Restrict database access — never expose PostgreSQL ports publicly
4. Enable per-user API key authentication (enabled by default)
5. Monitor Bull Board dashboard for failed jobs
6. Keep dependencies updated via `npm audit` and Dependabot
