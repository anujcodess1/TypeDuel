import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth.js';
import { userRepo } from '../db/repositories.js';
import { AppError } from './errorHandler.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    sessionId: string;
    elo: number;
    trust_score: number;
  };
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies?.['access_token'] as string | undefined;

  if (!token) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    next(new AppError(401, 'Invalid or expired token'));
    return;
  }

  const user = userRepo.findById(payload.sub);
  if (!user) {
    next(new AppError(401, 'User not found'));
    return;
  }

  req.user = {
    id: user.id,
    username: user.username,
    sessionId: payload.sessionId,
    elo: user.elo,
    trust_score: user.trust_score,
  };

  next();
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies?.['access_token'] as string | undefined;
  if (!token) { next(); return; }

  const payload = verifyAccessToken(token);
  if (!payload) { next(); return; }

  const user = userRepo.findById(payload.sub);
  if (user) {
    req.user = {
      id: user.id,
      username: user.username,
      sessionId: payload.sessionId,
      elo: user.elo,
      trust_score: user.trust_score,
    };
  }
  next();
}
