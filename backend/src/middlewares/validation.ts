import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from './errorHandler';

export function validateRequest(schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: any = {};

    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) errors.body = error.details.map((d) => d.message);
    }

    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) errors.query = error.details.map((d) => d.message);
    }

    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) errors.params = error.details.map((d) => d.message);
    }

    if (Object.keys(errors).length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', errors);
    }

    next();
  };
}
