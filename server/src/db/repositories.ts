import { getDb } from './connection.js';
import { runMigrations } from './migrations.js';
import { logger } from '../utils/logger.js';

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  is_guest: number;
  elo: number;
  trust_score: number;
  leaderboard_banned_until: string | null;
  provisional_games: number;
  created_at: string;
  updated_at: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  family: string;
  is_revoked: number;
  created_at: string;
  expires_at: string;
}

export interface Result {
  id: string;
  user_id: string | null;
  mode: 'solo' | 'duel' | 'room';
  difficulty: 'easy' | 'normal' | 'hard';
  duration: number;
  net_wpm: number;
  raw_wpm: number;
  accuracy: number;
  consistency: number;
  correct_chars: number;
  incorrect_chars: number;
  text_length: number;
  wpm_over_time: string;
  is_flagged: number;
  flag_reason: string | null;
  is_personal_best: number;
  created_at: string;
}

export interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  player1_wpm: number | null;
  player2_wpm: number | null;
  player1_accuracy: number | null;
  player2_accuracy: number | null;
  player1_elo_before: number;
  player2_elo_before: number;
  player1_elo_after: number | null;
  player2_elo_after: number | null;
  difficulty: string;
  duration: number;
  status: 'pending' | 'active' | 'finished' | 'abandoned';
  created_at: string;
  finished_at: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  device_info: string | null;
  ip: string | null;
  last_seen_at: string;
  created_at: string;
}

export interface LoginAttempt {
  id: string;
  identifier: string;
  ip: string;
  success: number;
  created_at: string;
}

class UserRepository {
  findById(id: string): User | null {
    return (getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined) ?? null;
  }

  findByUsername(username: string): User | null {
    return (getDb().prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as User | undefined) ?? null;
  }

  findByEmail(email: string): User | null {
    return (getDb().prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as User | undefined) ?? null;
  }

  create(data: {
    username: string;
    email: string;
    password_hash: string;
    is_guest?: number;
  }): User {
    const db = getDb();
    db.prepare(`
      INSERT INTO users (username, email, password_hash, is_guest)
      VALUES (?, ?, ?, ?)
    `).run(data.username, data.email, data.password_hash, data.is_guest ?? 0);
    return this.findByUsername(data.username)!;
  }

  updateElo(userId: string, elo: number): void {
    getDb().prepare('UPDATE users SET elo = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%SZ\', \'now\') WHERE id = ?').run(elo, userId);
  }

  updateTrustScore(userId: string, score: number): void {
    getDb().prepare('UPDATE users SET trust_score = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%SZ\', \'now\') WHERE id = ?').run(score, userId);
  }

  banFromLeaderboard(userId: string, until: string): void {
    getDb().prepare('UPDATE users SET leaderboard_banned_until = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%SZ\', \'now\') WHERE id = ?').run(until, userId);
  }

  updatePassword(userId: string, passwordHash: string): void {
    getDb().prepare('UPDATE users SET password_hash = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%SZ\', \'now\') WHERE id = ?').run(passwordHash, userId);
  }

  incrementProvisionalGames(userId: string): void {
    getDb().prepare('UPDATE users SET provisional_games = provisional_games + 1 WHERE id = ?').run(userId);
  }

  delete(userId: string): void {
    getDb().prepare('DELETE FROM users WHERE id = ?').run(userId);
  }

  getStats(userId: string): {
    tests_taken: number;
    best_wpm: number | null;
    avg_accuracy: number | null;
    wins: number;
    losses: number;
  } {
    const stats = getDb().prepare(`
      SELECT
        COUNT(*) as tests_taken,
        MAX(net_wpm) as best_wpm,
        AVG(accuracy) as avg_accuracy
      FROM results
      WHERE user_id = ? AND is_flagged = 0
    `).get(userId) as { tests_taken: number; best_wpm: number | null; avg_accuracy: number | null };

    const wl = getDb().prepare(`
      SELECT
        SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN (player1_id = ? OR player2_id = ?) AND winner_id != ? AND winner_id IS NOT NULL THEN 1 ELSE 0 END) as losses
      FROM matches
      WHERE (player1_id = ? OR player2_id = ?) AND status = 'finished'
    `).get(userId, userId, userId, userId, userId, userId) as { wins: number; losses: number };

    return { ...stats, wins: wl.wins ?? 0, losses: wl.losses ?? 0 };
  }
}

class RefreshTokenRepository {
  create(data: {
    user_id: string;
    token_hash: string;
    family: string;
    expires_at: string;
  }): void {
    getDb().prepare(`
      INSERT INTO refresh_tokens (user_id, token_hash, family, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(data.user_id, data.token_hash, data.family, data.expires_at);
  }

  findByHash(tokenHash: string): RefreshToken | null {
    return (getDb().prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash) as RefreshToken | undefined) ?? null;
  }

  revokeToken(id: string): void {
    getDb().prepare('UPDATE refresh_tokens SET is_revoked = 1 WHERE id = ?').run(id);
  }

  revokeFamily(family: string): void {
    getDb().prepare('UPDATE refresh_tokens SET is_revoked = 1 WHERE family = ?').run(family);
  }

  revokeAllForUser(userId: string): void {
    getDb().prepare('UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ?').run(userId);
  }

  cleanupExpired(): void {
    getDb().prepare('DELETE FROM refresh_tokens WHERE expires_at < strftime(\'%Y-%m-%dT%H:%M:%SZ\', \'now\')').run();
  }
}

class ResultRepository {
  create(data: Omit<Result, 'id' | 'created_at' | 'is_personal_best'>): string {
    const db = getDb();
    let isPersonalBest = 0;

    if (data.user_id && !data.is_flagged) {
      const current = db.prepare(`
        SELECT MAX(net_wpm) as best FROM results
        WHERE user_id = ? AND mode = ? AND difficulty = ? AND duration = ? AND is_flagged = 0
      `).get(data.user_id, data.mode, data.difficulty, data.duration) as { best: number | null };

      if (!current.best || data.net_wpm > current.best) {
        isPersonalBest = 1;
        db.prepare(`
          UPDATE results SET is_personal_best = 0
          WHERE user_id = ? AND mode = ? AND difficulty = ? AND duration = ?
        `).run(data.user_id, data.mode, data.difficulty, data.duration);
      }
    }

    const result = db.prepare(`
      INSERT INTO results (user_id, mode, difficulty, duration, net_wpm, raw_wpm, accuracy, consistency,
        correct_chars, incorrect_chars, text_length, wpm_over_time, is_flagged, flag_reason, is_personal_best)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.user_id, data.mode, data.difficulty, data.duration,
      data.net_wpm, data.raw_wpm, data.accuracy, data.consistency,
      data.correct_chars, data.incorrect_chars, data.text_length,
      data.wpm_over_time, data.is_flagged, data.flag_reason, isPersonalBest
    );

    return String(result.lastInsertRowid);
  }

  findById(id: string): Result | null {
    return (getDb().prepare('SELECT * FROM results WHERE id = ?').get(id) as Result | undefined) ?? null;
  }

  getLeaderboard(params: {
    difficulty: string;
    duration: number;
    period: 'daily' | 'weekly' | 'all';
    cursor?: string;
    limit?: number;
  }): { rows: (Result & { username: string; rank: number })[]; nextCursor: string | null } {
    const { difficulty, duration, period, cursor, limit = 20 } = params;
    const db = getDb();

    let dateFilter = '';
    if (period === 'daily') dateFilter = "AND r.created_at >= date('now', 'start of day')";
    else if (period === 'weekly') dateFilter = "AND r.created_at >= date('now', '-7 days')";

    const cursorFilter = cursor ? 'AND r.id < ?' : '';
    const cursorParam = cursor ? [cursor] : [];

    const rows = db.prepare(`
      SELECT r.*, u.username,
        ROW_NUMBER() OVER (ORDER BY r.net_wpm DESC, r.accuracy DESC) as rank
      FROM results r
      JOIN users u ON r.user_id = u.id
      WHERE r.difficulty = ?
        AND r.duration = ?
        AND r.is_flagged = 0
        AND (u.leaderboard_banned_until IS NULL OR u.leaderboard_banned_until < strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        ${dateFilter}
        ${cursorFilter}
      ORDER BY r.net_wpm DESC, r.accuracy DESC
      LIMIT ?
    `).all(difficulty, duration, ...cursorParam, limit + 1) as (Result & { username: string; rank: number })[];

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    return {
      rows,
      nextCursor: hasMore && rows.length > 0 ? (rows[rows.length - 1]?.id ?? null) : null,
    };
  }

  getMatchHistory(userId: string, limit = 20, offset = 0): Match[] {
    return getDb().prepare(`
      SELECT m.* FROM matches m
      WHERE (m.player1_id = ? OR m.player2_id = ?) AND m.status = 'finished'
      ORDER BY m.finished_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, userId, limit, offset) as Match[];
  }

  getEloHistory(userId: string): { elo: number; created_at: string }[] {
    return getDb().prepare(`
      SELECT
        CASE WHEN player1_id = ? THEN player1_elo_after ELSE player2_elo_after END as elo,
        finished_at as created_at
      FROM matches
      WHERE (player1_id = ? OR player2_id = ?) AND status = 'finished'
      ORDER BY finished_at ASC
      LIMIT 100
    `).all(userId, userId, userId) as { elo: number; created_at: string }[];
  }

  getUserBests(userId: string): Record<string, Record<string, number>> {
    const rows = getDb().prepare(`
      SELECT difficulty, duration, MAX(net_wpm) as best_wpm
      FROM results
      WHERE user_id = ? AND is_flagged = 0
      GROUP BY difficulty, duration
    `).all(userId) as { difficulty: string; duration: number; best_wpm: number }[];

    const bests: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      if (!bests[row.difficulty]) bests[row.difficulty] = {};
      bests[row.difficulty]![String(row.duration)] = row.best_wpm;
    }
    return bests;
  }

  flagResult(id: string, reason: string): void {
    getDb().prepare('UPDATE results SET is_flagged = 1, flag_reason = ? WHERE id = ?').run(reason, id);
  }
}

class MatchRepository {
  create(data: {
    player1_id: string;
    player2_id: string;
    player1_elo_before: number;
    player2_elo_before: number;
    difficulty: string;
    duration: number;
  }): Match {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO matches (player1_id, player2_id, player1_elo_before, player2_elo_before, difficulty, duration)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.player1_id, data.player2_id, data.player1_elo_before, data.player2_elo_before, data.difficulty, data.duration);

    return db.prepare('SELECT * FROM matches WHERE rowid = ?').get(result.lastInsertRowid) as Match;
  }

  findById(id: string): Match | null {
    return (getDb().prepare('SELECT * FROM matches WHERE id = ?').get(id) as Match | undefined) ?? null;
  }

  findActiveForUser(userId: string): Match | null {
    return (getDb().prepare(`
      SELECT * FROM matches
      WHERE (player1_id = ? OR player2_id = ?) AND status IN ('pending', 'active')
      LIMIT 1
    `).get(userId, userId) as Match | undefined) ?? null;
  }

  updateStatus(id: string, status: Match['status']): void {
    getDb().prepare('UPDATE matches SET status = ? WHERE id = ?').run(status, id);
  }

  finish(data: {
    id: string;
    winner_id: string | null;
    player1_wpm: number;
    player2_wpm: number;
    player1_accuracy: number;
    player2_accuracy: number;
    player1_elo_after: number;
    player2_elo_after: number;
  }): void {
    getDb().prepare(`
      UPDATE matches SET
        winner_id = ?, player1_wpm = ?, player2_wpm = ?,
        player1_accuracy = ?, player2_accuracy = ?,
        player1_elo_after = ?, player2_elo_after = ?,
        status = 'finished', finished_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `).run(
      data.winner_id, data.player1_wpm, data.player2_wpm,
      data.player1_accuracy, data.player2_accuracy,
      data.player1_elo_after, data.player2_elo_after,
      data.id
    );
  }
}

class SessionRepository {
  create(data: { user_id: string; device_info?: string | undefined; ip?: string | undefined }): Session {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO sessions (user_id, device_info, ip)
      VALUES (?, ?, ?)
    `).run(data.user_id, data.device_info ?? null, data.ip ?? null);
    return db.prepare('SELECT * FROM sessions WHERE rowid = ?').get(result.lastInsertRowid) as Session;
  }

  findByUser(userId: string): Session[] {
    return getDb().prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC').all(userId) as Session[];
  }

  updateLastSeen(id: string): void {
    getDb().prepare('UPDATE sessions SET last_seen_at = strftime(\'%Y-%m-%dT%H:%M:%SZ\', \'now\') WHERE id = ?').run(id);
  }

  revoke(id: string, userId: string): void {
    getDb().prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(id, userId);
  }

  revokeAll(userId: string): void {
    getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }
}

class LoginAttemptRepository {
  record(identifier: string, ip: string, success: boolean): void {
    getDb().prepare(`
      INSERT INTO login_attempts (identifier, ip, success)
      VALUES (?, ?, ?)
    `).run(identifier, ip, success ? 1 : 0);
  }

  countRecent(identifier: string, windowMs: number): number {
    const since = new Date(Date.now() - windowMs).toISOString();
    const row = getDb().prepare(`
      SELECT COUNT(*) as count FROM login_attempts
      WHERE identifier = ? AND success = 0 AND created_at > ?
    `).get(identifier, since) as { count: number };
    return row.count;
  }

  countRecentByIp(ip: string, windowMs: number): number {
    const since = new Date(Date.now() - windowMs).toISOString();
    const row = getDb().prepare(`
      SELECT COUNT(*) as count FROM login_attempts
      WHERE ip = ? AND success = 0 AND created_at > ?
    `).get(ip, since) as { count: number };
    return row.count;
  }

  cleanup(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    getDb().prepare('DELETE FROM login_attempts WHERE created_at < ?').run(cutoff);
  }
}

export const userRepo = new UserRepository();
export const refreshTokenRepo = new RefreshTokenRepository();
export const resultRepo = new ResultRepository();
export const matchRepo = new MatchRepository();
export const sessionRepo = new SessionRepository();
export const loginAttemptRepo = new LoginAttemptRepository();

export { runMigrations };
