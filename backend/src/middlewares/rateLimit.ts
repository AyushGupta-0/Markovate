import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const rateLimitMiddleware = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.ceil(config.rateLimit.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter.toString());
    res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      request_id: (req as any).requestId,
    });
  },
});
