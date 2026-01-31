import { Router } from 'express';
import { validateRequest } from '../middlewares/validation';
import { rateLimitMiddleware } from '../middlewares/rateLimit';
import { createUserSchema } from '../models/userSchemas';
import * as userService from '../services/userService';

const router = Router();

router.post(
  '/',
  rateLimitMiddleware,
  validateRequest({ body: createUserSchema }),
  async (req, res, next) => {
    try {
      const user = await userService.createUser(req.body);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
