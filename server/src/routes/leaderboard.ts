import { Router } from 'express';
import { z } from 'zod';
import { authenticate, optionalAuth, type AuthRequest } from '../middleware/auth.js';
import { validateQuery, validateParams } from '../middleware/validate.js';
import { leaderboardLimit } from '../middleware/rateLimiter.js';
import { resultRepo, userRepo } from '../db/repositories.js';
import { AppError } from '../middleware/errorHandler.js';
import { LRUCache } from 'lru-cache';

const router = Router();

const leaderboardCache = new LRUCache<string, any>({ max: 100, ttl: 30_000 });

const LeaderboardQuerySchema = z.object({
  difficulty: z.enum(['easy', 'normal', 'hard']).default('normal'),
  duration: z.coerce.number().int().refine(v => [15, 30, 60, 120].includes(v)).default(60),
  period: z.enum(['daily', 'weekly', 'all']).default('all'),
  cursor: z.string().optional(),
});

router.get('/', leaderboardLimit, optionalAuth, validateQuery(LeaderboardQuerySchema), (req: AuthRequest, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof LeaderboardQuerySchema>;
    const { difficulty, duration, period, cursor } = query;
    const cacheKey = `lb:${difficulty}:${duration}:${period}:${cursor ?? ''}`;
    const cached = leaderboardCache.get(cacheKey);
    if (cached && !cursor) {
      res.setHeader('X-Cache', 'HIT');
      res.json(cached);
      return;
    }

    const { rows, nextCursor } = resultRepo.getLeaderboard({
      difficulty,
      duration,
      period,
      ...(cursor ? { cursor } : {}),
    });

    const currentUserId = req.user?.id;
    let currentUserRow = null;
    if (currentUserId && !rows.some(r => r.user_id === currentUserId)) {
      const userRows = resultRepo.getLeaderboard({ difficulty, duration, period, limit: 1 } as Parameters<typeof resultRepo.getLeaderboard>[0]);
      const found = userRows.rows.find(r => r.user_id === currentUserId);
      if (found) currentUserRow = found;
    }

    const response = { rows, nextCursor, currentUserRow };
    if (!cursor) leaderboardCache.set(cacheKey, response);
    res.setHeader('X-Cache', 'MISS');
    res.json(response);
  } catch (err) {
    next(err);
  }
});

const ProfileParamsSchema = z.object({ username: z.string().min(1).max(20) });

router.get('/profile/:username', optionalAuth, validateParams(ProfileParamsSchema), (req: AuthRequest, res, next) => {
  try {
    const user = userRepo.findByUsername(req.params['username']!);
    if (!user) throw new AppError(404, 'User not found');

    const stats = userRepo.getStats(user.id);
    const bests = resultRepo.getUserBests(user.id);
    const eloHistory = resultRepo.getEloHistory(user.id);
    const matchHistory = resultRepo.getMatchHistory(user.id, 20);

    res.json({
      id: user.id,
      username: user.username,
      elo: user.elo,
      provisional_games: user.provisional_games,
      created_at: user.created_at,
      stats,
      bests,
      eloHistory,
      matchHistory,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, (req: AuthRequest, res, next) => {
  try {
    const user = userRepo.findById(req.user!.id)!;
    const stats = userRepo.getStats(user.id);
    const bests = resultRepo.getUserBests(user.id);
    const eloHistory = resultRepo.getEloHistory(user.id);
    const matchHistory = resultRepo.getMatchHistory(user.id, 20);

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      elo: user.elo,
      provisional_games: user.provisional_games,
      created_at: user.created_at,
      stats,
      bests,
      eloHistory,
      matchHistory,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
