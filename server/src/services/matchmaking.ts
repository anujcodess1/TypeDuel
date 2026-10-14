import { generateText } from './words.js';
import { userRepo } from '../db/repositories.js';

export interface QueueEntry {
  userId: string;
  username: string;
  socketId: string;
  elo: number;
  joinedAt: number;
  difficulty: 'easy' | 'normal' | 'hard';
  duration: number;
}

export interface PendingMatch {
  id: string;
  player1: QueueEntry;
  player2: QueueEntry;
  text: string;
  countdownStartAt: number;
  startedAt: number | null;
  keystrokes: Map<string, { char: string; index: number; correct: boolean; tsOffset: number; serverReceiveTime: number }[]>;
  player1Done: boolean;
  player2Done: boolean;
  player1Result: { netWpm: number; accuracy: number } | null;
  player2Result: { netWpm: number; accuracy: number } | null;
  disconnectTimeout: Map<string, NodeJS.Timeout>;
  tabBlurFlags: Set<string>;
  createdAt: number;
}

const queues = new Map<string, QueueEntry[]>();
const pendingMatches = new Map<string, PendingMatch>();
const userToMatch = new Map<string, string>();

function getQueueKey(difficulty: string, duration: number) {
  return `${difficulty}:${duration}`;
}

export function joinQueue(entry: QueueEntry): void {
  const key = getQueueKey(entry.difficulty, entry.duration);
  const queue = queues.get(key) ?? [];
  const existing = queue.findIndex(e => e.userId === entry.userId);
  if (existing !== -1) queue.splice(existing, 1);
  queue.push(entry);
  queues.set(key, queue);
}

export function leaveQueue(userId: string): void {
  for (const [key, queue] of queues.entries()) {
    const idx = queue.findIndex(e => e.userId === userId);
    if (idx !== -1) {
      queue.splice(idx, 1);
      queues.set(key, queue);
      return;
    }
  }
}

export function tryMatch(entry: QueueEntry): PendingMatch | null {
  const key = getQueueKey(entry.difficulty, entry.duration);
  const queue = queues.get(key) ?? [];
  const waitSecs = (Date.now() - entry.joinedAt) / 1000;
  const eloWindow = 100 + Math.min(waitSecs * 10, 400);

  const opponent = queue.find(
    e => e.userId !== entry.userId && Math.abs(e.elo - entry.elo) <= eloWindow,
  );

  if (!opponent) return null;

  queues.set(key, queue.filter(e => e.userId !== entry.userId && e.userId !== opponent.userId));

  const text = generateText(entry.difficulty, entry.duration);
  const match: PendingMatch = {
    id: `match_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    player1: entry,
    player2: opponent,
    text,
    countdownStartAt: Date.now(),
    startedAt: null,
    keystrokes: new Map([[entry.userId, []], [opponent.userId, []]]),
    player1Done: false,
    player2Done: false,
    player1Result: null,
    player2Result: null,
    disconnectTimeout: new Map(),
    tabBlurFlags: new Set(),
    createdAt: Date.now(),
  };

  pendingMatches.set(match.id, match);
  userToMatch.set(entry.userId, match.id);
  userToMatch.set(opponent.userId, match.id);

  return match;
}

export function getQueueWaitingCount(): number {
  let count = 0;
  for (const queue of queues.values()) count += queue.length;
  return count;
}

export function getMatch(matchId: string): PendingMatch | null {
  return pendingMatches.get(matchId) ?? null;
}

export function getMatchByUserId(userId: string): PendingMatch | null {
  const matchId = userToMatch.get(userId);
  if (!matchId) return null;
  return pendingMatches.get(matchId) ?? null;
}

export function removeMatch(matchId: string): void {
  const match = pendingMatches.get(matchId);
  if (!match) return;
  userToMatch.delete(match.player1.userId);
  userToMatch.delete(match.player2.userId);
  for (const timeout of match.disconnectTimeout.values()) {
    clearTimeout(timeout);
  }
  pendingMatches.delete(matchId);
}

export function cleanupStaleMatches(): void {
  const STALE_TIMEOUT = 10 * 60 * 1000;
  const now = Date.now();
  for (const [id, match] of pendingMatches.entries()) {
    if (now - match.createdAt > STALE_TIMEOUT) {
      removeMatch(id);
    }
  }
}
