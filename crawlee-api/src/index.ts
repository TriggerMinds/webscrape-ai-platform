import express from 'express';
import rateLimit from 'express-rate-limit';
import { scrapeRouter } from './routes/scrape';
import { authMiddleware, AuthenticatedRequest } from './middleware/auth';
import { createWorker } from './services/worker';
import { initDbSchema, getUserJobCount } from './services/db';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(express.json({ limit: '1mb' }));

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

app.use('/api/', globalLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', authMiddleware);

const userRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthenticatedRequest).userId || 'unknown',
  message: { error: 'Per-user rate limit exceeded (10 req/min). Please wait.' },
});

app.use('/api/scrape', userRateLimiter);

app.use('/api', scrapeRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

initDbSchema()
  .then(() => console.log('Database schema ready'))
  .catch((err) => console.error('Schema init failed:', err));

const worker = createWorker();

app.listen(PORT, () => {
  console.log(`Crawlee API listening on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await worker.close();
  process.exit(0);
});

export default app;
