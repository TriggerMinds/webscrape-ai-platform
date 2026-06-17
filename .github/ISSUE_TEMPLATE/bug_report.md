---
name: Bug report
about: Create a report to help us improve
title: ''
labels: bug
assignees: ''
---

## Bug Description

A clear and concise description of what the bug is.

## To Reproduce

Steps to reproduce the behaviour:

1. Start services with `docker compose up -d`
2. Send request `curl ...`
3. See error

## Expected Behaviour

A clear and concise description of what you expected to happen.

## Logs

```
Paste relevant logs from `docker compose logs crawlee-api` or worker output here.
```

## Environment

- OS: [e.g. Ubuntu 22.04, macOS 14, Windows 11]
- Docker version: `docker --version`
- Compose version: `docker compose version`
- Branch/commit: `git log --oneline -1`

## Additional Context

Add any other context about the problem here (e.g. proxy configuration, URL being scraped).
