import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

type ZodSchema = z.ZodTypeAny;

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError(400, 'Invalid request body', 'VALIDATION_ERROR'));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new AppError(400, 'Invalid query parameters', 'VALIDATION_ERROR'));
      return;
    }
    req.query = result.data;
    next();
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(new AppError(400, 'Invalid route parameters', 'VALIDATION_ERROR'));
      return;
    }
    req.params = result.data;
    next();
  };
}

export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;
const RESERVED_NAMES = new Set([
  'admin', 'root', 'system', 'moderator', 'typeduel', 'support',
  'help', 'official', 'staff', 'null', 'undefined', 'anonymous',
]);
const PROFANITY = new Set(['fuck', 'shit', 'ass', 'bitch', 'bastard']);

export function validateUsername(username: string): { valid: boolean; reason?: string } {
  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, reason: 'Username must be 3-20 characters, alphanumeric, hyphens, and underscores only' };
  }
  if (RESERVED_NAMES.has(username.toLowerCase())) {
    return { valid: false, reason: 'That username is reserved' };
  }
  for (const word of PROFANITY) {
    if (username.toLowerCase().includes(word)) {
      return { valid: false, reason: 'Username contains prohibited content' };
    }
  }
  return { valid: true };
}
