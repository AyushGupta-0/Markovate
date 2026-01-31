import { Router, Request, Response } from 'express';
import { validateRequest } from '../middlewares/validation';
import { rateLimitMiddleware } from '../middlewares/rateLimit';
import {
  createIncidentSchema,
  updateStatusSchema,
  addCommentSchema,
  listIncidentsSchema,
  incidentIdSchema,
} from '../models/incidentSchemas';
import * as incidentService from '../services/incidentService';
import { checkIdempotencyKey, storeIdempotencyKey, generateRequestHash } from '../utils/idempotency';
import { AppError } from '../middlewares/errorHandler';

const router = Router();

router.post(
  '/',
  rateLimitMiddleware,
  validateRequest({ body: createIncidentSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const idempotencyKey = req.headers['idempotency-key'] as string;

      if (idempotencyKey) {
        const requestHash = generateRequestHash(req.body);
        const check = await checkIdempotencyKey(idempotencyKey, requestHash);

        if (check.exists) {
          if (check.conflict) {
            throw new AppError(
              409,
              'IDEMPOTENCY_KEY_CONFLICT',
              'Idempotency key already used with different request body'
            );
          }

          // Return the existing incident
          if (check.incidentId) {
            const incident = await incidentService.getIncidentById(check.incidentId);
            return res.status(200).json(incident);
          }
        }

        // Create new incident
        const incident = await incidentService.createIncident(req.body);

        // Store idempotency key
        await storeIdempotencyKey(idempotencyKey, requestHash, incident.id);

        return res.status(201).json(incident);
      }

      // No idempotency key provided
      const incident = await incidentService.createIncident(req.body);
      res.status(201).json(incident);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/',
  validateRequest({ query: listIncidentsSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const params = {
        status: req.query.status as any,
        severity: req.query.severity as any,
        created_from: req.query.created_from ? new Date(req.query.created_from as string) : undefined,
        created_to: req.query.created_to ? new Date(req.query.created_to as string) : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };

      const result = await incidentService.listIncidents(params);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  validateRequest({ params: incidentIdSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const incident = await incidentService.getIncidentById(req.params.id);
      res.status(200).json(incident);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/:id/status',
  rateLimitMiddleware,
  validateRequest({ params: incidentIdSchema, body: updateStatusSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const incident = await incidentService.updateIncidentStatus(
        req.params.id,
        req.body.status
      );
      res.status(200).json(incident);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/comments',
  rateLimitMiddleware,
  validateRequest({ params: incidentIdSchema, body: addCommentSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const event = await incidentService.addComment(
        req.params.id,
        req.body.comment,
        req.body.userId
      );
      res.status(201).json(event);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
