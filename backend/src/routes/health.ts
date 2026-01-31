import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import redis from '../config/redis';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis connectivity
    await redis.ping();

    res.status(200).json({
      status: 'ready',
      database: 'connected',
      redis: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
      redis: 'disconnected',
    });
  }
});

export default router;
