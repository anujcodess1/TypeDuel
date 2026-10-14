import type { Server, Socket } from 'socket.io';
import * as crypto from 'crypto';
import { z } from 'zod';
import { verifyAccessToken } from '../services/auth.js';
import { userRepo, resultRepo, matchRepo } from '../db/repositories.js';
import { computeScore, computeElo } from '../services/scoring.js';
import { analyzeKeystrokes, updateTrustScore, shouldAutoban } from '../services/anticheat.js';
import {
  joinQueue, leaveQueue, tryMatch, getMatch, getMatchByUserId, removeMatch,
  getQueueWaitingCount,
} from '../services/matchmaking.js';
import {
  createRoom, getRoom, getRoomByUserId, joinRoom, leaveRoom, handleDisconnect,
  startCountdown, startGame, updatePlayerProgress, finishPlayer, serializeRoom,
  cleanupIdleRooms,
} from '../services/rooms.js';
import { CORS_ORIGINS } from '../config/index.js';
import { logger, auditLog } from '../utils/logger.js';
import { generateText } from '../services/words.js';

interface AuthSocket extends Socket {
  userId?: string;
  username?: string;
  userElo?: number;
}

const socketRateLimit = new Map<string, Map<string, number[]>>();
const ipConnectionCount = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 10;
const RATE_LIMITS: Record<string, { window: number; max: number }> = {
  'room:keystroke': { window: 1000, max: 200 },
  'duel:keystroke': { window: 1000, max: 200 },
  'room:progress': { window: 100, max: 20 },
  default: { window: 1000, max: 30 },
};

function checkSocketRate(socketId: string, event: string): boolean {
  const limit = RATE_LIMITS[event] ?? RATE_LIMITS['default']!;
  const now = Date.now();

  if (!socketRateLimit.has(socketId)) socketRateLimit.set(socketId, new Map());
  const socketLimits = socketRateLimit.get(socketId)!;
  const times = socketLimits.get(event) ?? [];
  const recent = times.filter(t => now - t < limit.window);

  if (recent.length >= limit.max) return false;
  recent.push(now);
  socketLimits.set(event, recent);
  return true;
}

const KeystrokeSchema = z.object({
  char: z.string().max(10),
  index: z.number().int().min(0).max(10000),
  correct: z.boolean(),
  tsOffset: z.number().int().min(0).max(600000),
});

const ProgressSchema = z.object({
  progress: z.number().min(0).max(100),
  wpm: z.number().min(0).max(500),
});

const soloSessions = new Map<string, {
  text: string;
  difficulty: string;
  duration: number;
  startedAt: number;
  sessionId: string;
  keystrokes: z.infer<typeof KeystrokeSchema>[];
  tabBlurred: boolean;
}>();

export function setupSocketHandlers(io: Server): void {
  io.use(async (socket: AuthSocket, next) => {
    const ip = socket.handshake.address;
    const origin = socket.handshake.headers.origin;

    if (origin && !CORS_ORIGINS.includes(origin)) {
      next(new Error('Origin not allowed'));
      return;
    }

    const connections = ipConnectionCount.get(ip) ?? 0;
    if (connections >= MAX_CONNECTIONS_PER_IP) {
      next(new Error('Too many connections from this IP'));
      return;
    }

    const token = socket.handshake.auth['token'] as string | undefined
      ?? (socket.handshake.headers.cookie ?? '')
          .split(';')
          .find(c => c.trim().startsWith('access_token='))
          ?.split('=')[1];

    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        const user = userRepo.findById(payload.sub);
        if (user) {
          socket.userId = user.id;
          socket.username = user.username;
          socket.userElo = user.elo;
        }
      }
    }

    ipConnectionCount.set(ip, connections + 1);
    next();
  });

  io.on('connection', (socket: AuthSocket) => {
    logger.debug({ socketId: socket.id, userId: socket.userId }, 'Socket connected');

    socket.on('disconnect', () => {
      const ip = socket.handshake.address;
      const count = ipConnectionCount.get(ip) ?? 1;
      ipConnectionCount.set(ip, Math.max(0, count - 1));
      socketRateLimit.delete(socket.id);

      if (socket.userId) {
        const match = getMatchByUserId(socket.userId);
        if (match) {
          const opponentId = match.player1.userId === socket.userId ? match.player2.userId : match.player1.userId;
          const opponent = io.sockets.sockets.get(
            match.player1.userId === socket.userId ? match.player2.socketId : match.player1.socketId,
          );

          const timeout = setTimeout(() => {
            opponent?.emit('duel:opponent_forfeited', { userId: socket.userId });
            removeMatch(match.id);
          }, 10000);

          match.disconnectTimeout.set(socket.userId, timeout);
        }

        const { room, rejoinToken } = handleDisconnect(socket.userId);
        if (room) {
          socket.to(`room:${room.code}`).emit('room:updated', serializeRoom(room));
          if (rejoinToken) {
            socket.emit('room:rejoin_token', { token: rejoinToken, code: room.code });
          }
        }
      }
    });

    socket.on('solo:start', (data: unknown, callback: (r: unknown) => void) => {
      if (!checkSocketRate(socket.id, 'solo:start')) {
        callback({ error: 'Rate limit exceeded' }); return;
      }

      const parsed = z.object({
        difficulty: z.enum(['easy', 'normal', 'hard']),
        duration: z.number().int().refine(v => [15, 30, 60, 120].includes(v)),
      }).safeParse(data);

      if (!parsed.success) { callback({ error: 'Invalid parameters' }); return; }

      const { difficulty, duration } = parsed.data;
      const text = generateText(difficulty, duration);
      const sessionId = crypto.randomUUID();

      soloSessions.set(socket.id, {
        text,
        difficulty,
        duration,
        startedAt: Date.now(),
        sessionId,
        keystrokes: [],
        tabBlurred: false,
      });

      callback({ text, sessionId });
    });

    socket.on('solo:keystroke', (data: unknown) => {
      if (!checkSocketRate(socket.id, 'solo:keystroke')) return;

      const session = soloSessions.get(socket.id);
      if (!session) return;

      const parsed = z.object({
        keystrokes: z.array(KeystrokeSchema).max(500),
        sessionId: z.string(),
      }).safeParse(data);

      if (!parsed.success || parsed.data.sessionId !== session.sessionId) return;

      const serverReceiveTime = Date.now() - session.startedAt;
      for (const ks of parsed.data.keystrokes) {
        session.keystrokes.push(ks);
      }
    });

    socket.on('solo:tab_blur', () => {
      const session = soloSessions.get(socket.id);
      if (session) session.tabBlurred = true;
    });

    socket.on('solo:finish', async (data: unknown, callback: (r: unknown) => void) => {
      if (!checkSocketRate(socket.id, 'solo:finish')) {
        callback({ error: 'Rate limit exceeded' }); return;
      }

      const session = soloSessions.get(socket.id);
      if (!session) { callback({ error: 'No active session' }); return; }

      const parsed = z.object({ sessionId: z.string() }).safeParse(data);
      if (!parsed.success || parsed.data.sessionId !== session.sessionId) {
        callback({ error: 'Invalid session' }); return;
      }

      soloSessions.delete(socket.id);

      const durationSecs = session.duration;
      const elapsedSecs = (Date.now() - session.startedAt) / 1000;

      if (Math.abs(elapsedSecs - durationSecs) > 5) {
        callback({ error: 'Timing validation failed' }); return;
      }

      const keystrokesWithServer = session.keystrokes.map(ks => ({
        ...ks,
        serverReceiveTime: ks.tsOffset,
      }));

      const score = computeScore({
        text: session.text,
        keystrokes: session.keystrokes,
        durationSecs,
        startedAt: session.startedAt,
        finishedAt: Date.now(),
      });

      const antiCheat = analyzeKeystrokes(
        keystrokesWithServer,
        session.text,
        score.netWpm,
        durationSecs,
      );

      let isFlagged = antiCheat.flagged || session.tabBlurred;
      let flagReason = antiCheat.reason ?? (session.tabBlurred ? 'Tab blur during test' : undefined);

      const userId = socket.userId;
      let resultId: string | undefined;

      if (userId) {
        const user = userRepo.findById(userId)!;
        const newTrustScore = updateTrustScore(user.trust_score, antiCheat.flagged);
        userRepo.updateTrustScore(userId, newTrustScore);

        if (shouldAutoban(newTrustScore)) {
          const banUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          userRepo.banFromLeaderboard(userId, banUntil);
          auditLog('auto_leaderboard_ban', { userId, trustScore: newTrustScore });
        }

        resultId = resultRepo.create({
          user_id: userId,
          mode: 'solo',
          difficulty: session.difficulty as 'easy' | 'normal' | 'hard',
          duration: durationSecs,
          net_wpm: score.netWpm,
          raw_wpm: score.rawWpm,
          accuracy: score.accuracy,
          consistency: score.consistency,
          correct_chars: score.correctChars,
          incorrect_chars: score.incorrectChars,
          text_length: session.text.length,
          wpm_over_time: JSON.stringify(score.wpmOverTime),
          is_flagged: isFlagged ? 1 : 0,
          flag_reason: flagReason ?? null,
        });
      }

      callback({
        score: {
          netWpm: score.netWpm,
          rawWpm: score.rawWpm,
          accuracy: score.accuracy,
          consistency: score.consistency,
          correctChars: score.correctChars,
          incorrectChars: score.incorrectChars,
          wpmOverTime: score.wpmOverTime,
        },
        resultId,
        flagged: isFlagged,
      });
    });

    socket.on('room:create', (data: unknown, callback: (r: unknown) => void) => {
      if (!socket.userId || !socket.username) {
        callback({ error: 'Authentication required' }); return;
      }
      if (!checkSocketRate(socket.id, 'room:create')) {
        callback({ error: 'Rate limit exceeded' }); return;
      }

      const parsed = z.object({
        difficulty: z.enum(['easy', 'normal', 'hard']).default('normal'),
        duration: z.number().int().refine(v => [15, 30, 60, 120].includes(v)).default(60),
        teamMode: z.enum(['1v1', '2v2', '4v4']).default('1v1'),
        password: z.string().max(50).optional(),
      }).safeParse(data);

      if (!parsed.success) { callback({ error: 'Invalid parameters' }); return; }

      const existingRoom = getRoomByUserId(socket.userId);
      if (existingRoom) {
        callback({ error: 'Already in a room' }); return;
      }

      const room = createRoom({
        hostId: socket.userId,
        hostUsername: socket.username,
        hostSocketId: socket.id,
        difficulty: parsed.data.difficulty,
        duration: parsed.data.duration,
        teamMode: parsed.data.teamMode,
        ...(parsed.data.password ? { password: parsed.data.password } : {}),
      });

      socket.join(`room:${room.code}`);
      callback({ room: serializeRoom(room) });
    });

    socket.on('room:join', (data: unknown, callback: (r: unknown) => void) => {
      if (!socket.userId || !socket.username) {
        callback({ error: 'Authentication required' }); return;
      }
      if (!checkSocketRate(socket.id, 'room:join')) {
        callback({ error: 'Rate limit exceeded' }); return;
      }

      const parsed = z.object({
        code: z.string().length(6).toUpperCase(),
        password: z.string().max(50).optional(),
      }).safeParse(data);

      if (!parsed.success) { callback({ error: 'Invalid room code' }); return; }

      const result = joinRoom({
        code: parsed.data.code,
        userId: socket.userId,
        username: socket.username,
        socketId: socket.id,
        ...(parsed.data.password ? { password: parsed.data.password } : {}),
      });

      if (!result.success) { callback({ error: result.error }); return; }

      socket.join(`room:${parsed.data.code}`);
      io.to(`room:${parsed.data.code}`).emit('room:updated', serializeRoom(result.room!));
      callback({ room: serializeRoom(result.room!) });
    });

    socket.on('room:leave', () => {
      if (!socket.userId) return;
      const room = getRoomByUserId(socket.userId);
      if (!room) return;

      socket.leave(`room:${room.code}`);
      leaveRoom(socket.userId);
      const updatedRoom = getRoom(room.code);
      if (updatedRoom) {
        io.to(`room:${room.code}`).emit('room:updated', serializeRoom(updatedRoom));
      }
    });

    socket.on('room:ready', (data: unknown) => {
      if (!socket.userId) return;
      const room = getRoomByUserId(socket.userId);
      if (!room) return;
      const player = room.players.get(socket.userId);
      if (!player) return;

      const parsed = z.object({ ready: z.boolean() }).safeParse(data);
      if (!parsed.success) return;

      player.isReady = parsed.data.ready;
      io.to(`room:${room.code}`).emit('room:updated', serializeRoom(room));
    });

    socket.on('room:start', (_data: unknown, callback: (r: unknown) => void) => {
      if (!socket.userId) { callback({ error: 'Not authenticated' }); return; }
      const room = getRoomByUserId(socket.userId);
      if (!room) { callback({ error: 'Not in a room' }); return; }
      const player = room.players.get(socket.userId);
      if (!player?.isHost) { callback({ error: 'Only the host can start' }); return; }
      if (room.players.size < 2) { callback({ error: 'Need at least 2 players' }); return; }

      const started = startCountdown(room.code);
      if (!started) { callback({ error: 'Failed to start' }); return; }

      io.to(`room:${room.code}`).emit('room:countdown', {
        countdownStartAt: room.countdownStartAt,
        text: room.text,
      });

      setTimeout(() => {
        startGame(room.code);
        io.to(`room:${room.code}`).emit('room:started', { startedAt: room.startedAt });
      }, 3000);

      callback({ ok: true });
    });

    socket.on('room:kick', (data: unknown, callback: (r: unknown) => void) => {
      if (!socket.userId) { callback({ error: 'Not authenticated' }); return; }
      const room = getRoomByUserId(socket.userId);
      if (!room) { callback({ error: 'Not in a room' }); return; }
      const player = room.players.get(socket.userId);
      if (!player?.isHost) { callback({ error: 'Only the host can kick' }); return; }

      const parsed = z.object({ targetId: z.string() }).safeParse(data);
      if (!parsed.success) { callback({ error: 'Invalid' }); return; }
      if (parsed.data.targetId === socket.userId) { callback({ error: 'Cannot kick yourself' }); return; }

      const target = room.players.get(parsed.data.targetId);
      if (!target) { callback({ error: 'Player not found' }); return; }

      const targetSocket = io.sockets.sockets.get(target.socketId);
      targetSocket?.emit('room:kicked');
      targetSocket?.leave(`room:${room.code}`);
      leaveRoom(parsed.data.targetId);

      io.to(`room:${room.code}`).emit('room:updated', serializeRoom(room));
      callback({ ok: true });
    });

    socket.on('room:keystroke', (data: unknown) => {
      if (!checkSocketRate(socket.id, 'room:keystroke')) return;
      if (!socket.userId) return;
      const room = getRoomByUserId(socket.userId);
      if (!room || room.status !== 'active') return;
    });

    socket.on('room:progress', (data: unknown) => {
      if (!checkSocketRate(socket.id, 'room:progress')) return;
      if (!socket.userId) return;
      const room = getRoomByUserId(socket.userId);
      if (!room || room.status !== 'active') return;

      const parsed = ProgressSchema.safeParse(data);
      if (!parsed.success) return;

      updatePlayerProgress(room.code, socket.userId, parsed.data.progress, parsed.data.wpm);
      io.to(`room:${room.code}`).emit('room:progress', {
        userId: socket.userId,
        progress: parsed.data.progress,
        wpm: parsed.data.wpm,
      });
    });

    socket.on('room:finish', async (data: unknown, callback: (r: unknown) => void) => {
      if (!socket.userId) { callback({ error: 'Not authenticated' }); return; }
      const room = getRoomByUserId(socket.userId);
      if (!room || room.status !== 'active') { callback({ error: 'No active game' }); return; }

      const parsed = z.object({
        netWpm: z.number().min(0).max(500),
        accuracy: z.number().min(0).max(100),
      }).safeParse(data);
      if (!parsed.success) { callback({ error: 'Invalid result' }); return; }

      const position = finishPlayer(room.code, socket.userId, parsed.data.netWpm, parsed.data.accuracy);

      io.to(`room:${room.code}`).emit('room:player_finished', {
        userId: socket.userId,
        position,
        netWpm: parsed.data.netWpm,
        accuracy: parsed.data.accuracy,
      });

      if ((room.status as string) === 'finished') {
        io.to(`room:${room.code}`).emit('room:finished', serializeRoom(room));
      }

      callback({ position });
    });

    socket.on('duel:queue', (data: unknown, callback: (r: unknown) => void) => {
      if (!socket.userId || !socket.username) {
        callback({ error: 'Authentication required' }); return;
      }
      if (!checkSocketRate(socket.id, 'duel:queue')) {
        callback({ error: 'Rate limit exceeded' }); return;
      }

      const parsed = z.object({
        difficulty: z.enum(['easy', 'normal', 'hard']).default('normal'),
        duration: z.number().int().refine(v => [15, 30, 60, 120].includes(v)).default(60),
      }).safeParse(data);
      if (!parsed.success) { callback({ error: 'Invalid parameters' }); return; }

      const existingMatch = getMatchByUserId(socket.userId);
      if (existingMatch) { callback({ error: 'Already in a match' }); return; }

      const entry = {
        userId: socket.userId,
        username: socket.username,
        socketId: socket.id,
        elo: socket.userElo ?? 1200,
        joinedAt: Date.now(),
        ...parsed.data,
      };

      joinQueue(entry);
      const match = tryMatch(entry);
      const waiting = getQueueWaitingCount();
      io.emit('duel:queue_count', { waiting });

      if (match) {
        const p1Socket = io.sockets.sockets.get(match.player1.socketId);
        const p2Socket = io.sockets.sockets.get(match.player2.socketId);

        p1Socket?.join(`match:${match.id}`);
        p2Socket?.join(`match:${match.id}`);

        io.to(`match:${match.id}`).emit('duel:matched', {
          matchId: match.id,
          opponent: {
            player1: { id: match.player1.userId, username: match.player1.username, elo: match.player1.elo },
            player2: { id: match.player2.userId, username: match.player2.username, elo: match.player2.elo },
          },
          countdownStartAt: match.countdownStartAt,
        });

        setTimeout(() => {
          match.startedAt = Date.now();
          io.to(`match:${match.id}`).emit('duel:started', {
            text: match.text,
            startedAt: match.startedAt,
          });
        }, 3000);
      } else {
        callback({ queued: true, waiting });
        return;
      }

      callback({ matched: true });
    });

    socket.on('duel:leave_queue', () => {
      if (socket.userId) {
        leaveQueue(socket.userId);
        io.emit('duel:queue_count', { waiting: getQueueWaitingCount() });
      }
    });

    socket.on('duel:progress', (data: unknown) => {
      if (!checkSocketRate(socket.id, 'duel:keystroke')) return;
      if (!socket.userId) return;

      const match = getMatchByUserId(socket.userId);
      if (!match || !match.startedAt) return;

      const parsed = ProgressSchema.safeParse(data);
      if (!parsed.success) return;

      socket.to(`match:${match.id}`).emit('duel:opponent_progress', {
        progress: parsed.data.progress,
        wpm: parsed.data.wpm,
      });
    });

    socket.on('duel:tab_blur', () => {
      if (!socket.userId) return;
      const match = getMatchByUserId(socket.userId);
      if (match) match.tabBlurFlags.add(socket.userId);
    });

    socket.on('duel:finish', async (data: unknown, callback: (r: unknown) => void) => {
      if (!socket.userId) { callback({ error: 'Not authenticated' }); return; }

      const match = getMatchByUserId(socket.userId);
      if (!match || !match.startedAt) { callback({ error: 'No active match' }); return; }

      const parsed = z.object({
        netWpm: z.number().min(0).max(500),
        rawWpm: z.number().min(0).max(500),
        accuracy: z.number().min(0).max(100),
      }).safeParse(data);
      if (!parsed.success) { callback({ error: 'Invalid result' }); return; }

      const isPlayer1 = match.player1.userId === socket.userId;
      const flagged = match.tabBlurFlags.has(socket.userId) || parsed.data.netWpm > 300;

      if (isPlayer1) {
        if (match.player1Done) { callback({ error: 'Already submitted' }); return; }
        match.player1Done = true;
        match.player1Result = { netWpm: parsed.data.netWpm, accuracy: parsed.data.accuracy };
      } else {
        if (match.player2Done) { callback({ error: 'Already submitted' }); return; }
        match.player2Done = true;
        match.player2Result = { netWpm: parsed.data.netWpm, accuracy: parsed.data.accuracy };
      }

      if (match.player1Done && match.player2Done) {
        const p1 = match.player1Result!;
        const p2 = match.player2Result!;

        let winnerId: string | null = null;
        if (p1.netWpm > p2.netWpm) winnerId = match.player1.userId;
        else if (p2.netWpm > p1.netWpm) winnerId = match.player2.userId;
        else if (p1.accuracy > p2.accuracy) winnerId = match.player1.userId;
        else if (p2.accuracy > p1.accuracy) winnerId = match.player2.userId;

        const p1User = userRepo.findById(match.player1.userId);
        const p2User = userRepo.findById(match.player2.userId);

        if (p1User && p2User && !flagged) {
          const p1IsProvisional = p1User.provisional_games < 10;
          const p2IsProvisional = p2User.provisional_games < 10;

          const p1NewElo = computeElo(p1User.elo, p2User.elo, winnerId === p1User.id, p1IsProvisional);
          const p2NewElo = computeElo(p2User.elo, p1User.elo, winnerId === p2User.id, p2IsProvisional);

          userRepo.updateElo(p1User.id, p1NewElo);
          userRepo.updateElo(p2User.id, p2NewElo);
          userRepo.incrementProvisionalGames(p1User.id);
          userRepo.incrementProvisionalGames(p2User.id);

          const dbMatch = matchRepo.create({
            player1_id: p1User.id,
            player2_id: p2User.id,
            player1_elo_before: p1User.elo,
            player2_elo_before: p2User.elo,
            difficulty: match.player1.difficulty,
            duration: match.player1.duration,
          });

          matchRepo.finish({
            id: dbMatch.id,
            winner_id: winnerId,
            player1_wpm: p1.netWpm,
            player2_wpm: p2.netWpm,
            player1_accuracy: p1.accuracy,
            player2_accuracy: p2.accuracy,
            player1_elo_after: p1NewElo,
            player2_elo_after: p2NewElo,
          });

          io.to(`match:${match.id}`).emit('duel:result', {
            winnerId,
            player1: { userId: p1User.id, netWpm: p1.netWpm, accuracy: p1.accuracy, eloChange: p1NewElo - p1User.elo, newElo: p1NewElo },
            player2: { userId: p2User.id, netWpm: p2.netWpm, accuracy: p2.accuracy, eloChange: p2NewElo - p2User.elo, newElo: p2NewElo },
          });
        }

        removeMatch(match.id);
      } else {
        socket.to(`match:${match.id}`).emit('duel:opponent_finished', {
          netWpm: parsed.data.netWpm,
          accuracy: parsed.data.accuracy,
        });
      }

      callback({ ok: true });
    });
  });

  setInterval(cleanupIdleRooms, 5 * 60 * 1000);
}
