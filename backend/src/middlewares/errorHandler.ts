import { Request, Response, NextFunction } from 'express';
import { RequestWithId, ErrorResponse } from '../types';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const reqWithId = req as RequestWithId;

  if (err instanceof AppError) {
    const errorResponse: ErrorResponse = {
      code: err.code,
      message: err.message,
      request_id: reqWithId.requestId,
    };

    if (err.details) {
      errorResponse.details = err.details;
    }

    return res.status(err.statusCode).json(errorResponse);
  }

  // Handle unexpected errors
  console.error('Unexpected error:', err);

  const errorResponse: ErrorResponse = {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    request_id: reqWithId.requestId,
  };

  res.status(500).json(errorResponse);
}
