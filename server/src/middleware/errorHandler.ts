import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isProd = process.env['NODE_ENV'] === 'production';

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  if (err instanceof Error) {
    logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
    res.status(500).json({
      error: 'Internal server error',
      ...(isProd ? {} : { detail: err.message }),
    });
    return;
  }

  logger.error({ err, url: req.url }, 'Unknown error');
  res.status(500).json({ error: 'Internal server error' });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
