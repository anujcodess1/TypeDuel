import { Router } from 'express';
import type { Server } from 'socket.io';
import { getDb } from '../db/connection.js';
import { getActiveRoomCount } from '../services/rooms.js';
import { leaderboardLimit } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/', leaderboardLimit, (req, res) => {
  const io = req.app.get('io') as Server | undefined;
  const userIds = new Set<string>();
  if (io) {
    for (const socket of io.sockets.sockets.values()) {
      const uid = (socket as { userId?: string }).userId;
      if (uid) userIds.add(uid);
    }
  }

  const db = getDb();
  const racesToday = (db.prepare(
    "SELECT COUNT(*) AS c FROM results WHERE created_at >= date('now', 'start of day')"
  ).get() as { c: number }).c;
  const duelsToday = (db.prepare(
    "SELECT COUNT(*) AS c FROM matches WHERE finished_at >= date('now', 'start of day')"
  ).get() as { c: number }).c;
  const totalRaces = (db.prepare(
    'SELECT (SELECT COUNT(*) FROM results) + (SELECT COUNT(*) FROM matches) AS c'
  ).get() as { c: number }).c;

  res.json({
    onlinePlayers: userIds.size,
    activeRooms: getActiveRoomCount(),
    racesToday,
    duelsToday,
    totalRaces,
  });
});

export default router;
