import * as crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import { generateText } from './words.js';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type TeamMode = '1v1' | '2v2' | '4v4';
export type Team = 'A' | 'B';

export const TEAM_MAX_PLAYERS: Record<TeamMode, number> = {
  '1v1': 2,
  '2v2': 4,
  '4v4': 8,
};

export interface Player {
  id: string;
  username: string;
  socketId: string;
  team: Team;
  isReady: boolean;
  isHost: boolean;
  progress: number;
  wpm: number;
  position: number;
  finished: boolean;
  finishedAt: number | null;
  netWpm: number | null;
  accuracy: number | null;
  disconnectedAt: number | null;
  rejoinToken: string | null;
}

export interface Room {
  code: string;
  password: string | null;
  difficulty: 'easy' | 'normal' | 'hard';
  duration: number;
  teamMode: TeamMode;
  maxPlayers: number;
  players: Map<string, Player>;
  status: 'lobby' | 'countdown' | 'active' | 'finished';
  text: string | null;
  startedAt: number | null;
  countdownStartAt: number | null;
  createdAt: number;
  lastActivity: number;
  sessionId: string;
  teamScores: { A: number; B: number } | null;
  winnerTeam: Team | null;
}

const rooms = new LRUCache<string, Room>({ max: 500, ttl: 2 * 60 * 60 * 1000 });
const userToRoom = new Map<string, string>();

export function generateRoomCode(): string {
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += ROOM_ALPHABET[bytes[i]! % ROOM_ALPHABET.length];
  }
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

function balanceTeam(room: Room): Team {
  const counts = { A: 0, B: 0 };
  for (const p of room.players.values()) counts[p.team]++;
  return counts.A <= counts.B ? 'A' : 'B';
}

export function createRoom(params: {
  hostId: string;
  hostUsername: string;
  hostSocketId: string;
  difficulty: 'easy' | 'normal' | 'hard';
  duration: number;
  teamMode: TeamMode;
  password?: string;
}): Room {
  const code = generateRoomCode();
  const passwordHash = params.password
    ? crypto.createHash('sha256').update(params.password).digest('hex')
    : null;

  const maxPlayers = TEAM_MAX_PLAYERS[params.teamMode];

  const host: Player = {
    id: params.hostId,
    username: params.hostUsername,
    socketId: params.hostSocketId,
    team: 'A',
    isReady: false,
    isHost: true,
    progress: 0,
    wpm: 0,
    position: 0,
    finished: false,
    finishedAt: null,
    netWpm: null,
    accuracy: null,
    disconnectedAt: null,
    rejoinToken: null,
  };

  const room: Room = {
    code,
    password: passwordHash,
    difficulty: params.difficulty,
    duration: params.duration,
    teamMode: params.teamMode,
    maxPlayers,
    players: new Map([[params.hostId, host]]),
    status: 'lobby',
    text: null,
    startedAt: null,
    countdownStartAt: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    sessionId: crypto.randomUUID(),
    teamScores: null,
    winnerTeam: null,
  };

  rooms.set(code, room);
  userToRoom.set(params.hostId, code);
  return room;
}

export function getRoom(code: string): Room | null {
  return rooms.get(code) ?? null;
}

export function getRoomByUserId(userId: string): Room | null {
  const code = userToRoom.get(userId);
  if (!code) return null;
  return rooms.get(code) ?? null;
}

export function getActiveRoomCount(): number {
  let count = 0;
  for (const room of rooms.values()) {
    if (room.status === 'lobby' || room.status === 'countdown' || room.status === 'active') count++;
  }
  return count;
}

export function joinRoom(params: {
  code: string;
  userId: string;
  username: string;
  socketId: string;
  password?: string;
}): { success: boolean; error?: string; room?: Room } {
  const room = rooms.get(params.code);
  if (!room) return { success: false, error: 'Room not found' };
  if (room.status !== 'lobby') return { success: false, error: 'Game already in progress' };
  if (room.players.size >= room.maxPlayers) return { success: false, error: 'Room is full' };

  if (room.password) {
    const hash = crypto.createHash('sha256').update(params.password ?? '').digest('hex');
    if (hash !== room.password) return { success: false, error: 'Incorrect password' };
  }

  if (room.players.has(params.userId)) {
    const player = room.players.get(params.userId)!;
    player.socketId = params.socketId;
    player.disconnectedAt = null;
    return { success: true, room };
  }

  const player: Player = {
    id: params.userId,
    username: params.username,
    socketId: params.socketId,
    team: balanceTeam(room),
    isReady: false,
    isHost: false,
    progress: 0,
    wpm: 0,
    position: 0,
    finished: false,
    finishedAt: null,
    netWpm: null,
    accuracy: null,
    disconnectedAt: null,
    rejoinToken: null,
  };

  room.players.set(params.userId, player);
  room.lastActivity = Date.now();
  userToRoom.set(params.userId, params.code);
  return { success: true, room };
}

export function leaveRoom(userId: string): void {
  const code = userToRoom.get(userId);
  if (!code) return;
  const room = rooms.get(code);
  if (!room) {
    userToRoom.delete(userId);
    return;
  }

  room.players.delete(userId);
  userToRoom.delete(userId);

  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }

  const hasHost = [...room.players.values()].some(p => p.isHost);
  if (!hasHost) {
    const newHost = room.players.values().next().value;
    if (newHost) {
      newHost.isHost = true;
    }
  }

  room.lastActivity = Date.now();
}

export function handleDisconnect(userId: string): { room: Room | null; rejoinToken: string | null } {
  const code = userToRoom.get(userId);
  if (!code) return { room: null, rejoinToken: null };
  const room = rooms.get(code);
  if (!room) return { room: null, rejoinToken: null };

  const player = room.players.get(userId);
  if (!player) return { room: null, rejoinToken: null };

  const rejoinToken = crypto.randomBytes(32).toString('hex');
  player.disconnectedAt = Date.now();
  player.rejoinToken = rejoinToken;

  if (player.isHost && room.status === 'lobby') {
    const others = [...room.players.values()].filter(p => p.id !== userId);
    if (others.length > 0) {
      others[0]!.isHost = true;
    }
  }

  return { room, rejoinToken };
}

export function startCountdown(code: string): boolean {
  const room = rooms.get(code);
  if (!room || room.status !== 'lobby') return false;

  const players = [...room.players.values()];
  if (players.length < 2) return false;

  const teamA = players.filter(p => p.team === 'A').length;
  const teamB = players.filter(p => p.team === 'B').length;
  if (teamA === 0 || teamB === 0) return false;

  room.text = generateText(room.difficulty, room.duration);
  room.status = 'countdown';
  room.countdownStartAt = Date.now();
  room.lastActivity = Date.now();
  return true;
}

export function startGame(code: string): boolean {
  const room = rooms.get(code);
  if (!room || room.status !== 'countdown') return false;
  room.status = 'active';
  room.startedAt = Date.now();
  room.lastActivity = Date.now();
  return true;
}

export function updatePlayerProgress(
  code: string,
  userId: string,
  progress: number,
  wpm: number,
): void {
  const room = rooms.get(code);
  if (!room) return;
  const player = room.players.get(userId);
  if (!player) return;
  player.progress = progress;
  player.wpm = wpm;
  room.lastActivity = Date.now();

  const finished = [...room.players.values()].filter(p => p.finished);
  const notFinished = [...room.players.values()].filter(p => !p.finished);
  let pos = finished.length + 1;
  notFinished.sort((a, b) => b.progress - a.progress);
  for (const p of notFinished) {
    p.position = pos++;
  }
}

function computeTeamScores(room: Room): { A: number; B: number } {
  const sums = { A: { wpm: 0, acc: 0, n: 0 }, B: { wpm: 0, acc: 0, n: 0 } };
  for (const p of room.players.values()) {
    if (p.netWpm === null) continue;
    sums[p.team].wpm += p.netWpm;
    sums[p.team].acc += p.accuracy ?? 0;
    sums[p.team].n++;
  }
  return {
    A: sums.A.n > 0 ? Math.round((sums.A.wpm / sums.A.n) * 10) / 10 : 0,
    B: sums.B.n > 0 ? Math.round((sums.B.wpm / sums.B.n) * 10) / 10 : 0,
  };
}

export function finishPlayer(
  code: string,
  userId: string,
  netWpm: number,
  accuracy: number,
): number {
  const room = rooms.get(code);
  if (!room) return 0;
  const player = room.players.get(userId);
  if (!player || player.finished) return 0;

  player.finished = true;
  player.finishedAt = Date.now();
  player.netWpm = netWpm;
  player.accuracy = accuracy;

  const finishedCount = [...room.players.values()].filter(p => p.finished).length;
  player.position = finishedCount;

  const allFinished = [...room.players.values()].every(p => p.finished);
  if (allFinished) {
    room.status = 'finished';
    room.teamScores = computeTeamScores(room);
    if (room.teamScores.A > room.teamScores.B) {
      room.winnerTeam = 'A';
    } else if (room.teamScores.B > room.teamScores.A) {
      room.winnerTeam = 'B';
    } else {
      const accA = avgAccuracy(room, 'A');
      const accB = avgAccuracy(room, 'B');
      room.winnerTeam = accA >= accB ? 'A' : 'B';
      if (accA === accB) room.winnerTeam = null;
    }
  }

  room.lastActivity = Date.now();
  return finishedCount;
}

function avgAccuracy(room: Room, team: Team): number {
  const members = [...room.players.values()].filter(p => p.team === team && p.accuracy !== null);
  if (members.length === 0) return 0;
  return members.reduce((s, p) => s + (p.accuracy ?? 0), 0) / members.length;
}

export function cleanupIdleRooms(): void {
  const IDLE_TIMEOUT = 30 * 60 * 1000;
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > IDLE_TIMEOUT || room.players.size === 0) {
      for (const player of room.players.values()) {
        userToRoom.delete(player.id);
      }
      rooms.delete(code);
    }
  }
}

export function serializeRoom(room: Room) {
  return {
    code: room.code,
    difficulty: room.difficulty,
    duration: room.duration,
    teamMode: room.teamMode,
    maxPlayers: room.maxPlayers,
    status: room.status,
    hasPassword: !!room.password,
    countdownStartAt: room.countdownStartAt,
    startedAt: room.startedAt,
    hostId: [...room.players.values()].find(p => p.isHost)?.id ?? null,
    teamScores: room.teamScores,
    winnerTeam: room.winnerTeam,
    players: [...room.players.values()].map(p => ({
      id: p.id,
      userId: p.id,
      username: p.username,
      team: p.team,
      isReady: p.isReady,
      isHost: p.isHost,
      progress: p.progress,
      wpm: p.wpm,
      position: p.position,
      finished: p.finished,
      netWpm: p.netWpm,
      accuracy: p.accuracy,
    })),
  };
}
