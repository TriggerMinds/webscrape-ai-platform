import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { scrapeRouter } from './routes/scrape';
import { adminRouter } from './routes/admin';
import { authMiddleware, AuthenticatedRequest } from './middleware/auth';
import { createWorker } from './services/worker';
import { runMigrations } from './services/migrate';
import { logger } from './services/logger';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  }),
);

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
app.use('/admin', adminRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err: err.message }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

runMigrations()
  .then(() => logger.info('Migrations complete'))
  .catch((err) => logger.error({ err }, 'Migration failed'));

const worker = createWorker();

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Crawlee API listening');
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await worker.close();
  process.exit(0);
});

export default app;
