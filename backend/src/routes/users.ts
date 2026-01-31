import { Router } from 'express';
import { validateRequest } from '../middlewares/validation';
import { rateLimitMiddleware } from '../middlewares/rateLimit';
import { createUserSchema } from '../models/userSchemas';
import * as userService from '../services/userService';

const router = Router();

/**
 * @swagger
 * /v1/users:
 *   post:
 *     tags:
 *       - Users
 *     summary: Create a new user
 *     description: Creates a new user. Email must be unique. Rate limited to 100 requests per minute.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 example: Alice Johnson
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice@example.com
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: User with this email already exists
 *       429:
 *         description: Rate limit exceeded
 */
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
