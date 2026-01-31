import { Request, Response, NextFunction } from 'express';
import { RequestWithId } from '../types';

export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const reqWithId = req as RequestWithId;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      request_id: reqWithId.requestId,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(logData));
  });

  next();
}
