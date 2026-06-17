import express from 'express';
import { scrapeRouter } from './routes/scrape';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', scrapeRouter);

app.listen(PORT, () => {
  console.log(`Crawlee API listening on port ${PORT}`);
});

export default app;
