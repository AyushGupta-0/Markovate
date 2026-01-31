import Joi from 'joi';

export const createIncidentSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().required(),
  severity: Joi.string().valid('P1', 'P2', 'P3').required(),
  createdBy: Joi.string().uuid().required(),
});

export const updateStatusSchema = Joi.object({
  status: Joi.string().valid('OPEN', 'ACK', 'RESOLVED').required(),
});

export const addCommentSchema = Joi.object({
  comment: Joi.string().min(1).required(),
  userId: Joi.string().uuid().required(),
});

export const listIncidentsSchema = Joi.object({
  status: Joi.string().valid('OPEN', 'ACK', 'RESOLVED').optional(),
  severity: Joi.string().valid('P1', 'P2', 'P3').optional(),
  created_from: Joi.date().iso().optional(),
  created_to: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const incidentIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});
