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

/**
 * @swagger
 * /v1/incidents:
 *   post:
 *     tags:
 *       - Incidents
 *     summary: Create a new incident
 *     description: |
 *       Creates a new incident with idempotency support. 
 *       Include `Idempotency-Key` header to prevent duplicates on retry.
 *       Rate limited to 100 requests per minute.
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema:
 *           type: string
 *         required: false
 *         description: Unique key to prevent duplicate incidents (optional but recommended)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - severity
 *               - createdBy
 *             properties:
 *               title:
 *                 type: string
 *                 example: Database connection timeout
 *               description:
 *                 type: string
 *                 example: Production database experiencing connection timeouts
 *               severity:
 *                 type: string
 *                 enum: [P1, P2, P3]
 *                 example: P1
 *               createdBy:
 *                 type: string
 *                 format: uuid
 *                 example: 550e8400-e29b-41d4-a716-446655440000
 *     responses:
 *       201:
 *         description: Incident created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Incident'
 *       200:
 *         description: Incident already exists (idempotency - same key and body)
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       409:
 *         description: Idempotency key conflict (same key, different body)
 *       429:
 *         description: Rate limit exceeded
 */
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

/**
 * @swagger
 * /v1/incidents:
 *   get:
 *     tags:
 *       - Incidents
 *     summary: List incidents with filters and pagination
 *     description: Returns paginated list of incidents. Results sorted by created_at DESC (newest first).
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, ACK, RESOLVED]
 *         description: Filter by status
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [P1, P2, P3]
 *         description: Filter by severity
 *       - in: query
 *         name: created_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter incidents created after this date
 *       - in: query
 *         name: created_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter incidents created before this date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of incidents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Incident'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
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

/**
 * @swagger
 * /v1/incidents/{id}:
 *   get:
 *     tags:
 *       - Incidents
 *     summary: Get incident details
 *     description: |
 *       Returns incident details with last 20 events. 
 *       **This endpoint is CACHED** (5 min TTL). 
 *       Cache is invalidated on status update or new comment.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Incident ID
 *     responses:
 *       200:
 *         description: Incident details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Incident'
 *       404:
 *         description: Incident not found
 */
router.get(
  '/:id',
  validateRequest({ params: incidentIdSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const incident = await incidentService.getIncidentById(req.params.id as string);
      res.status(200).json(incident);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/incidents/{id}/status:
 *   patch:
 *     tags:
 *       - Incidents
 *     summary: Update incident status
 *     description: |
 *       Updates incident status with validation of state transitions.
 *       Valid transitions: OPEN→ACK, OPEN→RESOLVED, ACK→RESOLVED.
 *       Setting same status is idempotent. Invalidates cache.
 *       Rate limited to 100 requests per minute.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Incident ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, ACK, RESOLVED]
 *                 example: ACK
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Incident'
 *       400:
 *         description: Invalid status transition
 *       404:
 *         description: Incident not found
 *       429:
 *         description: Rate limit exceeded
 */
router.patch(
  '/:id/status',
  rateLimitMiddleware,
  validateRequest({ params: incidentIdSchema, body: updateStatusSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const incident = await incidentService.updateIncidentStatus(
        req.params.id as string,
        req.body.status
      );
      res.status(200).json(incident);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/incidents/{id}/comments:
 *   post:
 *     tags:
 *       - Incidents
 *     summary: Add comment to incident
 *     description: |
 *       Adds a comment to an incident. Creates COMMENTED event in audit log.
 *       Invalidates cache. Rate limited to 100 requests per minute.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Incident ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *               - userId
 *             properties:
 *               comment:
 *                 type: string
 *                 example: Investigation started. Checking database logs.
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 example: 550e8400-e29b-41d4-a716-446655440000
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 incidentId:
 *                   type: string
 *                   format: uuid
 *                 type:
 *                   type: string
 *                   example: COMMENTED
 *                 payload:
 *                   type: object
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Incident not found
 *       429:
 *         description: Rate limit exceeded
 */
router.post(
  '/:id/comments',
  rateLimitMiddleware,
  validateRequest({ params: incidentIdSchema, body: addCommentSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const event = await incidentService.addComment(
        req.params.id as string,
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
