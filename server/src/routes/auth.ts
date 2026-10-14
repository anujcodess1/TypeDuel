import { Router } from 'express';
import { z } from 'zod';
import * as crypto from 'crypto';
import {
  hashPassword, verifyPassword, generateTokens, rotateRefreshToken,
  validatePasswordStrength, checkLockout, constantTimeResponse,
} from '../services/auth.js';
import { userRepo, refreshTokenRepo, sessionRepo, loginAttemptRepo } from '../db/repositories.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { validateUsername } from '../middleware/validate.js';
import { authLimit, refreshLimit } from '../middleware/rateLimiter.js';
import { AppError } from '../middleware/errorHandler.js';
import { COOKIE_OPTIONS, env } from '../config/index.js';
import { auditLog } from '../utils/logger.js';

const router = Router();

const RegisterSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
});

const LoginSchema = z.object({
  usernameOrEmail: z.string().min(1).max(255),
  password: z.string().min(1).max(128),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
});

const DeleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
});

function setTokenCookies(res: import('express').Response, tokens: { accessToken: string; refreshToken: string }) {
  const maxAge15m = 15 * 60 * 1000;
  const maxAge7d = 7 * 24 * 60 * 60 * 1000;

  res.cookie('access_token', tokens.accessToken, { ...COOKIE_OPTIONS, maxAge: maxAge15m });
  res.cookie('refresh_token', tokens.refreshToken, { ...COOKIE_OPTIONS, maxAge: maxAge7d, path: '/api/auth/refresh' });
}

function clearTokenCookies(res: import('express').Response) {
  res.clearCookie('access_token', COOKIE_OPTIONS);
  res.clearCookie('refresh_token', { ...COOKIE_OPTIONS, path: '/api/auth/refresh' });
}

router.post('/register', authLimit, validateBody(RegisterSchema), async (req, res, next) => {
  try {
    const { username, email, password } = req.body as z.infer<typeof RegisterSchema>;

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) {
      throw new AppError(400, usernameCheck.reason ?? 'Invalid username');
    }

    const passwordCheck = validatePasswordStrength(password, username);
    if (!passwordCheck.valid) {
      throw new AppError(400, passwordCheck.reason ?? 'Weak password');
    }

    if (userRepo.findByUsername(username)) {
      await new Promise(r => setTimeout(r, 200));
      throw new AppError(400, 'Registration failed');
    }
    if (userRepo.findByEmail(email)) {
      await new Promise(r => setTimeout(r, 200));
      throw new AppError(400, 'Registration failed');
    }

    const passwordHash = await hashPassword(password);
    const user = userRepo.create({ username, email, password_hash: passwordHash });
    const sessionId = crypto.randomUUID();
    const tokens = generateTokens(user, sessionId);

    const ua = req.headers['user-agent'];
    sessionRepo.create({ user_id: user.id, device_info: ua, ip: req.ip });

    setTokenCookies(res, tokens);
    auditLog('user_registered', { userId: user.id, username });

    res.status(201).json({ user: { id: user.id, username: user.username, email: user.email, elo: user.elo } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimit, validateBody(LoginSchema), async (req, res, next) => {
  try {
    const { usernameOrEmail, password } = req.body as z.infer<typeof LoginSchema>;
    const ip = req.ip ?? 'unknown';

    const lockout = checkLockout(usernameOrEmail, ip);
    if (lockout.locked) {
      throw new AppError(429, 'Account temporarily locked. Try again later.');
    }

    const result = await constantTimeResponse(async () => {
      const user = usernameOrEmail.includes('@')
        ? userRepo.findByEmail(usernameOrEmail)
        : userRepo.findByUsername(usernameOrEmail);

      if (!user) return null;
      const valid = await verifyPassword(user.password_hash, password);
      if (!valid) return null;
      return user;
    });

    loginAttemptRepo.record(usernameOrEmail, ip, !!result);

    if (!result) {
      auditLog('login_failed', { identifier: usernameOrEmail, ip });
      throw new AppError(401, 'Invalid credentials');
    }

    const sessionId = crypto.randomUUID();
    const tokens = generateTokens(result, sessionId);

    const ua = req.headers['user-agent'];
    sessionRepo.create({ user_id: result.id, device_info: ua, ip });

    setTokenCookies(res, tokens);
    auditLog('login_success', { userId: result.id, username: result.username });

    res.json({ user: { id: result.id, username: result.username, email: result.email, elo: result.elo } });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', refreshLimit, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    if (!refreshToken) throw new AppError(401, 'No refresh token');

    const result = await rotateRefreshToken(refreshToken);
    if ('error' in result) {
      clearTokenCookies(res);
      if ('reuseDetected' in result && result.reuseDetected) {
        auditLog('refresh_token_reuse_detected', {});
      }
      throw new AppError(401, result.error);
    }

    setTokenCookies(res, result.tokens);
    res.json({ user: { id: result.user.id, username: result.user.username, email: result.user.email, elo: result.user.elo } });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authenticate, (req: AuthRequest, res, next) => {
  try {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    if (refreshToken) {
      const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const stored = refreshTokenRepo.findByHash(hash);
      if (stored) refreshTokenRepo.revokeToken(stored.id);
    }
    clearTokenCookies(res);
    auditLog('logout', { userId: req.user?.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/logout-all', authenticate, (req: AuthRequest, res, next) => {
  try {
    refreshTokenRepo.revokeAllForUser(req.user!.id);
    sessionRepo.revokeAll(req.user!.id);
    clearTokenCookies(res);
    auditLog('logout_all', { userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, (req: AuthRequest, res, next) => {
  try {
    const user = userRepo.findById(req.user!.id);
    if (!user) throw new AppError(404, 'User not found');
    res.json({ id: user.id, username: user.username, email: user.email, elo: user.elo, provisional_games: user.provisional_games });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', authenticate, validateBody(ChangePasswordSchema), async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as z.infer<typeof ChangePasswordSchema>;
    const user = userRepo.findById(req.user!.id)!;

    const valid = await verifyPassword(user.password_hash, currentPassword);
    if (!valid) throw new AppError(401, 'Current password is incorrect');

    const check = validatePasswordStrength(newPassword, user.username);
    if (!check.valid) throw new AppError(400, check.reason ?? 'Weak password');

    const hash = await hashPassword(newPassword);
    userRepo.updatePassword(user.id, hash);
    refreshTokenRepo.revokeAllForUser(user.id);

    clearTokenCookies(res);
    auditLog('password_changed', { userId: user.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/account', authenticate, validateBody(DeleteAccountSchema), async (req: AuthRequest, res, next) => {
  try {
    const { password } = req.body as z.infer<typeof DeleteAccountSchema>;
    const user = userRepo.findById(req.user!.id)!;

    const valid = await verifyPassword(user.password_hash, password);
    if (!valid) throw new AppError(401, 'Password is incorrect');

    userRepo.delete(user.id);
    clearTokenCookies(res);
    auditLog('account_deleted', { userId: user.id, username: user.username });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/sessions', authenticate, (req: AuthRequest, res, next) => {
  try {
    const sessions = sessionRepo.findByUser(req.user!.id);
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

router.delete('/sessions/:sessionId', authenticate, (req: AuthRequest, res, next) => {
  try {
    sessionRepo.revoke(req.params['sessionId']!, req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
