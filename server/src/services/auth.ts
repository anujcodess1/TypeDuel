import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { env } from '../config/index.js';
import { userRepo, refreshTokenRepo, sessionRepo, loginAttemptRepo } from '../db/repositories.js';
import type { User } from '../db/repositories.js';
import { auditLog } from '../utils/logger.js';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

const COMMON_PASSWORDS = new Set([
  'password123', 'qwerty123', '123456789', 'password1', 'letmein1',
  'welcome123', 'monkey123', 'dragon123', 'master123', 'abc123456',
  'password1234', 'qwerty12345', 'iloveyou123', 'admin12345', 'trustno123',
  '111111111111', 'aaaaaaaaaaaa', 'passw0rd123', 'changeme123', 'samsung123',
]);

export function validatePasswordStrength(
  password: string,
  username?: string,
): { valid: boolean; reason?: string } {
  if (password.length < 12) return { valid: false, reason: 'Password must be at least 12 characters' };
  if (password.length > 128) return { valid: false, reason: 'Password is too long' };
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return { valid: false, reason: 'Password is too common' };
  if (/^\d+$/.test(password)) return { valid: false, reason: 'Password must not be only digits' };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(password)).length;
  if (classes < 3) return { valid: false, reason: 'Password needs at least 3 of: lowercase, uppercase, digit, symbol' };
  if (username && username.length >= 3 && password.toLowerCase().includes(username.toLowerCase())) {
    return { valid: false, reason: 'Password must not contain your username' };
  }
  return { valid: true };
}

export interface TokenPayload {
  sub: string;
  username: string;
  sessionId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function generateTokens(user: User, sessionId: string): AuthTokens {
  const payload: TokenPayload = { sub: user.id, username: user.username, sessionId };

  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as string,
  } as jwt.SignOptions);

  const family = crypto.randomUUID();
  const refreshTokenValue = crypto.randomBytes(64).toString('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  refreshTokenRepo.create({
    user_id: user.id,
    token_hash: refreshTokenHash,
    family,
    expires_at: expiresAt,
  });

  return { accessToken, refreshToken: refreshTokenValue };
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function rotateRefreshToken(
  refreshTokenValue: string,
): Promise<{ tokens: AuthTokens; user: User } | { error: string; reuseDetected?: boolean }> {
  const tokenHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');
  const stored = refreshTokenRepo.findByHash(tokenHash);

  if (!stored) return { error: 'Invalid refresh token' };

  if (stored.is_revoked) {
    refreshTokenRepo.revokeFamily(stored.family);
    auditLog('refresh_token_reuse', { userId: stored.user_id, family: stored.family });
    return { error: 'Token reuse detected', reuseDetected: true };
  }

  if (stored.expires_at < new Date().toISOString()) {
    refreshTokenRepo.revokeToken(stored.id);
    return { error: 'Refresh token expired' };
  }

  const user = userRepo.findById(stored.user_id);
  if (!user) return { error: 'User not found' };

  refreshTokenRepo.revokeToken(stored.id);

  const sessionId = crypto.randomUUID();
  const tokens = generateTokens(user, sessionId);

  return { tokens, user };
}

export function checkLockout(identifier: string, ip: string): { locked: boolean; waitMs?: number } {
  const accountAttempts = loginAttemptRepo.countRecent(identifier, 15 * 60 * 1000);
  const ipAttempts = loginAttemptRepo.countRecentByIp(ip, 15 * 60 * 1000);

  if (accountAttempts >= 5 || ipAttempts >= 10) {
    const wait = Math.min(Math.pow(2, Math.max(accountAttempts, ipAttempts) - 4) * 1000, 30 * 60 * 1000);
    return { locked: true, waitMs: wait };
  }

  return { locked: false };
}

export async function constantTimeResponse<T>(fn: () => Promise<T>): Promise<T> {
  const minTime = 200;
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  if (elapsed < minTime) {
    await new Promise(resolve => setTimeout(resolve, minTime - elapsed));
  }
  return result;
}
