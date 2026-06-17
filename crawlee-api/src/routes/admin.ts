import { Router, Request, Response, NextFunction } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { scrapeQueue } from '../services/queue';
import { authMiddleware } from '../middleware/auth';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(scrapeQueue)],
  serverAdapter,
});

export const adminRouter = Router();

adminRouter.use(authMiddleware);

adminRouter.use(
  '/queues',
  (req: Request, res: Response, next: NextFunction) => {
    serverAdapter.getRouter()(req, res, next);
  },
);
