import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { getSocket, connectSocket } from '@/services/socket';
import { reauthSocket } from '@/services/api';
import { toast } from '@/store/toast';
import { TypingArea } from '@/components/TypingArea';
import { Users, UserPlus, Copy, Check, LogOut, Play, Crown, ArrowRight } from 'lucide-react';

type Team = 'A' | 'B';
type TeamMode = '1v1' | '2v2' | '4v4';

interface PlayerInfo {
  userId: string;
  username: string;
  team: Team;
  isHost: boolean;
  isReady: boolean;
  progress: number;
  wpm: number;
  position?: number;
  finished?: boolean;
  netWpm?: number | null;
  accuracy?: number | null;
}

interface RoomState {
  code: string;
  hostId: string;
  difficulty: 'easy' | 'normal' | 'hard';
  duration: number;
  teamMode: TeamMode;
  maxPlayers: number;
  hasPassword?: boolean;
  status: 'lobby' | 'countdown' | 'active' | 'finished';
  players: PlayerInfo[];
  teamScores?: { A: number; B: number } | null;
  winnerTeam?: Team | null;
}

function normalizeRoom(data: any): RoomState {
  const players: PlayerInfo[] = (Array.isArray(data.players) ? data.players : Object.values(data.players || {})).map(
    (p: any) => ({ ...p, userId: p.userId ?? p.id }),
  );
  return {
    code: data.code,
    hostId: data.hostId ?? players.find((p) => p.isHost)?.userId ?? '',
    difficulty: data.difficulty,
    duration: data.duration,
    teamMode: data.teamMode ?? '1v1',
    maxPlayers: data.maxPlayers ?? players.length,
    hasPassword: data.hasPassword,
    status: data.status,
    players,
    teamScores: data.teamScores ?? null,
    winnerTeam: data.winnerTeam ?? null,
  };
}

const TEAM_LABEL: Record<Team, string> = { A: 'Team A', B: 'Team B' };

export function RoomPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoCreatedRef = useRef(false);

  const [inRoom, setInRoom] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [copied, setCopied] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [createDifficulty, setCreateDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [createDuration, setCreateDuration] = useState<number>(60);
  const [createTeamMode, setCreateTeamMode] = useState<TeamMode>('2v2');
  const [createPassword, setCreatePassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [gameText, setGameText] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [finalRank, setFinalRank] = useState<number | null>(null);

  const socketRef = useRef<ReturnType<typeof getSocket>>(getSocket());
  const startTimeRef = useRef(0);
  const keystrokesRef = useRef<{ correct: boolean }[]>([]);
  const progressThrottleRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    connectSocket();
    const s = getSocket();
    socketRef.current = s;

    s.on('room:updated', (data: any) => {
      setRoom(normalizeRoom(data));
      setInRoom(true);
    });

    s.on('room:countdown', (data: { text: string; countdownStartAt: number }) => {
      setGameText(data.text);
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    });

    s.on('room:started', () => {
      startTimeRef.current = Date.now();
      keystrokesRef.current = [];
      progressThrottleRef.current = 0;
      finishedRef.current = false;
      setRoom((prev) => (prev ? { ...prev, status: 'active' } : prev));
      setCountdown(null);
      setFinished(false);
      setFinalRank(null);
    });

    s.on('room:progress', (data: { userId: string; progress: number; wpm: number }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const updated = prev.players.map((p) =>
          p.userId === data.userId ? { ...p, progress: data.progress, wpm: data.wpm } : p,
        );
        return { ...prev, players: updated };
      });
    });

    s.on('room:player_finished', (data: { userId: string; position: number; netWpm: number; accuracy: number }) => {
      if (user && data.userId === user.id) {
        setFinalRank(data.position);
        setFinished(true);
      }
      setRoom((prev) => {
        if (!prev) return prev;
        const updated = prev.players.map((p) =>
          p.userId === data.userId
            ? { ...p, finished: true, position: data.position, netWpm: data.netWpm, accuracy: data.accuracy }
            : p,
        );
        return { ...prev, players: updated };
      });
    });

    s.on('room:finished', (data: any) => {
      setRoom({ ...normalizeRoom(data), status: 'finished' });
      setFinished(true);
    });

    s.on('room:kicked', () => {
      toast('You were removed from the room', 'info');
      setInRoom(false);
      setRoom(null);
    });

    return () => {
      s.off('room:updated');
      s.off('room:countdown');
      s.off('room:started');
      s.off('room:progress');
      s.off('room:player_finished');
      s.off('room:finished');
      s.off('room:kicked');
    };
  }, [user]);

  function createRoom(
    opts: {
      difficulty: 'easy' | 'normal' | 'hard';
      duration: number;
      teamMode: TeamMode;
      password?: string;
    },
    retryOnExisting = true,
  ) {
    setLoading(true);
    socketRef.current.emit('room:create', opts, (res: any) => {
      setLoading(false);
      if (res.error) {
        if (/authentication required|not authenticated/i.test(res.error)) {
          void reauthSocket().then((ok) => {
            if (ok) socketRef.current.emit('room:create', opts, (r2: any) => {
              setLoading(false);
              if (r2.error) { toast(r2.error, 'error'); return; }
              setRoom(normalizeRoom(r2.room));
              setInRoom(true);
            });
            else toast('Your session expired — log in again', 'error');
          });
          return;
        }
        if (retryOnExisting && /already in a room/i.test(res.error)) {
          socketRef.current.emit('room:leave');
          setTimeout(() => createRoom(opts, false), 400);
          return;
        }
        toast(res.error, 'error');
        return;
      }
      setRoom(normalizeRoom(res.room));
      setInRoom(true);
      toast(`Room ${res.room.code} created — share the code!`, 'success');
    });
  }

  function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast('Please log in to create team rooms', 'error');
      navigate('/auth/login');
      return;
    }
    createRoom({
      difficulty: createDifficulty,
      duration: createDuration,
      teamMode: createTeamMode,
      password: createPassword || undefined,
    });
  }

  useEffect(() => {
    if (searchParams.get('create') !== '1' || !user || autoCreatedRef.current) return;
    autoCreatedRef.current = true;
    const tm = searchParams.get('teamMode');
    createRoom({
      difficulty: ((localStorage.getItem('typeduel_diff') as 'easy' | 'normal' | 'hard') || 'normal'),
      duration: Number(localStorage.getItem('typeduel_dur')) || 60,
      teamMode: tm === '1v1' || tm === '2v2' || tm === '4v4' ? tm : '2v2',
      password: searchParams.get('password') || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast('Please log in to join rooms', 'error');
      navigate('/auth/login');
      return;
    }
    if (!joinCode || joinCode.length !== 6) {
      toast('Room code must be 6 characters', 'error');
      return;
    }
    setLoading(true);
    socketRef.current.emit(
      'room:join',
      { code: joinCode.toUpperCase(), password: joinPassword || undefined },
      (res: any) => {
        setLoading(false);
        if (res.error) {
          toast(res.error, 'error');
          return;
        }
        setRoom(normalizeRoom(res.room));
        setInRoom(true);
        toast(`Joined room ${res.room.code}!`, 'success');
      },
    );
  }

  function handleLeave() {
    socketRef.current.emit('room:leave');
    setInRoom(false);
    setRoom(null);
    setGameText('');
    setFinished(false);
  }

  function toggleReady() {
    if (!room || !user) return;
    const me = room.players.find((p) => p.userId === user.id);
    if (!me) return;
    socketRef.current.emit('room:ready', { ready: !me.isReady });
  }

  function handleStart() {
    socketRef.current.emit('room:start', {}, (res: any) => {
      if (res.error) toast(res.error, 'error');
    });
  }

  function handleKick(targetId: string) {
    socketRef.current.emit('room:kick', { targetId }, (res: any) => {
      if (res?.error) toast(res.error, 'error');
    });
  }

  function handleCopyCode() {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function submitFinish() {
    if (finishedRef.current || !gameText) return;
    finishedRef.current = true;
    const elapsed = (Date.now() - startTimeRef.current) / 1000 / 60;
    const correct = keystrokesRef.current.filter((k) => k.correct).length;
    const total = keystrokesRef.current.length;
    const netWpm = elapsed > 0 ? Math.round((correct / 5) / elapsed * 10) / 10 : 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 100;
    socketRef.current.emit('room:finish', { netWpm, accuracy });
  }

  function handleKeystroke(_char: string, index: number, correct: boolean) {
    if (!gameText || finishedRef.current) return;
    keystrokesRef.current.push({ correct });
    const pct = Math.min(100, Math.round((index / gameText.length) * 100));

    const now = Date.now();
    if (now - progressThrottleRef.current > 100) {
      progressThrottleRef.current = now;
      const elapsed = (now - startTimeRef.current) / 1000 / 60;
      const correctCount = keystrokesRef.current.filter((k) => k.correct).length;
      const wpm = elapsed > 0 ? Math.round((correctCount / 5) / elapsed) : 0;
      socketRef.current.emit('room:progress', { progress: pct, wpm });
    }

    if (index >= gameText.length - 1) submitFinish();
  }

  const isHost = user && room?.hostId === user.id;
  const myPlayer = user && room?.players.find((p) => p.userId === user.id);

  if (!inRoom || !room) {
    return (
      <div className="flex-1 min-h-0 w-full max-w-3xl mx-auto px-4 sm:px-6 py-2 flex flex-col justify-center">
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Team Rooms</h1>
        <p className="text-muted mb-4">
          Host a {`1v1 / 2v2 / 4v4`} lobby with a 6-letter code, or join a friend's room.
        </p>

        <div className="border-t border-default">
          <h2 className="text-lg font-bold py-3 flex items-center gap-2">
            <Crown size={17} className="text-accent" /> Create a lobby
          </h2>
          <form onSubmit={handleCreateRoom} className="border-t border-default pb-4">
            <div className="flex flex-wrap gap-4 items-end mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1.5">Format</p>
                <div className="flex border-y border-default divide-x divide-default font-mono">
                  {(['1v1', '2v2', '4v4'] as TeamMode[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCreateTeamMode(t)}
                      className={`px-5 py-2.5 text-sm cursor-pointer transition-colors ${
                        createTeamMode === t ? 'text-accent font-bold bg-accent/5' : 'text-muted hover:text-[var(--text)]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1.5">Difficulty</p>
                <select
                  value={createDifficulty}
                  onChange={(e) => setCreateDifficulty(e.target.value as 'easy' | 'normal' | 'hard')}
                  className="input"
                >
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1.5">Timer</p>
                <select value={createDuration} onChange={(e) => setCreateDuration(Number(e.target.value))} className="input">
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                  <option value={120}>120s</option>
                </select>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1.5">Password (optional)</p>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Open lobby"
                  className="input"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2 px-8 py-2.5 rounded-full font-bold cursor-pointer"
            >
              <Users size={16} /> Create {createTeamMode} Lobby
            </button>
          </form>
        </div>

        <div className="border-t border-default">
          <h2 className="text-lg font-bold py-3 flex items-center gap-2">
            <Users size={17} className="text-accent" /> Join with code
          </h2>
          <form onSubmit={handleJoinRoom} className="flex flex-wrap gap-4 items-end pb-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted mb-1.5">Room code</label>
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="AB12CD"
                className="input font-mono text-center tracking-widest text-lg font-bold w-40"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted mb-1.5">Password (optional)</label>
              <input
                type="password"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                placeholder="If set"
                className="input"
              />
            </div>
            <button
              type="submit"
              disabled={loading || joinCode.length !== 6}
              className="btn-secondary flex items-center gap-2 px-8 py-2.5 rounded-full font-bold cursor-pointer"
            >
              Join Room <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  const teamSize = room.maxPlayers / 2;
  const teams: Team[] = ['A', 'B'];

  return (
    <div className="flex-1 min-h-0 w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-col justify-center">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-default">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1">Room code</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-accent">{room.code}</span>
            <button onClick={handleCopyCode} className="p-1.5 text-muted hover:text-[var(--text)] cursor-pointer" title="Copy room code">
              {copied ? <Check size={16} className="text-correct" /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-xs text-muted mt-1.5 font-mono">
            {room.teamMode} · {room.difficulty} · {room.duration}s{room.hasPassword ? ' · locked' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {room.status === 'lobby' && (
            <>
              <button
                onClick={toggleReady}
                className={`px-5 py-2.5 text-sm font-bold border-b-2 cursor-pointer transition-colors ${
                  myPlayer?.isReady
                    ? 'border-correct text-correct'
                    : 'border-transparent text-muted hover:text-[var(--text)]'
                }`}
              >
                {myPlayer?.isReady ? '✓ READY' : 'MARK READY'}
              </button>
              {isHost && (
                <button
                  onClick={handleStart}
                  disabled={room.players.length < 2}
                  className="btn-primary text-sm px-6 py-2.5 rounded-full flex items-center gap-2 font-bold cursor-pointer disabled:opacity-50"
                >
                  <Play size={14} fill="currentColor" /> Start Race
                </button>
              )}
            </>
          )}
          <button onClick={handleLeave} className="flex items-center gap-1.5 text-sm text-muted hover:text-red-400 cursor-pointer">
            <LogOut size={14} /> Leave
          </button>
        </div>
      </div>

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center">
          <div className="text-center">
            <span key={countdown} className="block text-8xl font-black text-accent animate-scale-in">{countdown}</span>
            <p className="text-lg text-white mt-4 font-semibold">Get ready…</p>
          </div>
        </div>
      )}

      {/* Waiting banner */}
      {room.status === 'lobby' && room.players.length < 2 && (
        <div className="py-5 text-center border-b border-default">
          <p className="text-lg font-bold mb-1">Waiting for challengers…</p>
          <p className="text-sm text-muted">
            Send code <strong className="font-mono text-accent tracking-widest">{room.code}</strong> to a friend — both teams need at least one racer.
          </p>
        </div>
      )}

      {/* Active race */}
      {room.status === 'active' && gameText && (
        <div className="py-4">
          <TypingArea
            text={gameText}
            isActive
            onKeystroke={handleKeystroke}
            onFinish={submitFinish}
            disabled={finished}
          />
        </div>
      )}

      {/* Team scoreboard (live during race, final after) */}
      {room.status !== 'lobby' && room.status !== 'countdown' && (
        <div className="pb-2">
          {teams.map((t) => {
            const members = room.players.filter((p) => p.team === t);
            const avgWpm = room.status === 'finished'
              ? room.teamScores?.[t]
              : (() => {
                  const active = members.filter((p) => p.wpm > 0 || p.netWpm);
                  if (active.length === 0) return null;
                  return Math.round((active.reduce((s, p) => s + (p.netWpm ?? p.wpm), 0) / active.length) * 10) / 10;
                })();
            const isWinning = room.status === 'finished' && room.winnerTeam === t;
            return (
              <div key={t} className={`border-t border-default py-4 ${isWinning ? 'bg-accent/5' : ''}`}>
                <div className="flex items-baseline justify-between mb-3 px-1">
                  <p className={`font-mono text-sm font-bold uppercase tracking-widest ${t === 'A' ? 'text-accent' : 'text-muted'}`}>
                    {TEAM_LABEL[t]}
                    {isWinning && ' — wins'}
                  </p>
                  <p className="font-mono text-sm tabular-nums text-muted">
                    team avg <span className={`font-bold ${t === 'A' ? 'text-accent' : 'text-[var(--text)]'}`}>{avgWpm === null ? '—' : avgWpm}</span> wpm
                  </p>
                </div>
                {members.map((p) => (
                  <div key={p.userId} className="flex items-center gap-4 px-1 py-1.5 text-sm">
                    <span className="w-32 sm:w-40 truncate font-medium flex items-center gap-1.5">
                      {p.isHost && <Crown size={12} className="text-yellow-500 shrink-0" />}
                      {p.username}
                      {p.userId === user?.id && <span className="text-xs text-muted">(you)</span>}
                    </span>
                    {room.status === 'finished' ? (
                      <>
                        <span className="font-mono text-xs text-muted w-10">#{p.position ?? '–'}</span>
                        <span className="font-mono tabular-nums ml-auto">{p.netWpm ?? 0} wpm</span>
                        <span className="font-mono tabular-nums text-muted w-16 text-right">{p.accuracy ?? 0}%</span>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 h-1.5 rounded-full bg-[var(--raised)] overflow-hidden">
                          <span
                            className={`block h-full transition-all duration-300 ${t === 'A' ? 'bg-accent' : 'bg-[var(--muted)]'}`}
                            style={{ width: `${p.progress ?? 0}%` }}
                          />
                        </span>
                        <span className="font-mono tabular-nums text-xs w-20 text-right">
                          {p.finished ? <span className="text-correct font-bold">done</span> : `${p.wpm || 0} wpm`}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Lobby teams */}
      {room.status === 'lobby' && (
        <div className="py-5 grid sm:grid-cols-2 gap-8">
          {teams.map((t) => {
            const members = room.players.filter((p) => p.team === t);
            const empties = Math.max(0, teamSize - members.length);
            return (
              <div key={t}>
                <p className={`font-mono text-sm font-bold uppercase tracking-widest border-b pb-2 mb-3 ${
                  t === 'A' ? 'text-accent border-accent/40' : 'text-muted border-default'
                }`}>
                  {TEAM_LABEL[t]} <span className="font-normal normal-case tracking-normal text-xs">({members.length}/{teamSize})</span>
                </p>
                {members.map((p) => (
                  <div key={p.userId} className="flex items-center justify-between gap-2 py-2 text-sm border-b border-default">
                    <span className="flex items-center gap-1.5 font-medium truncate">
                      {p.isHost && <Crown size={13} className="text-yellow-500 shrink-0" />}
                      {p.username}
                      {p.userId === user?.id && <span className="text-xs text-muted">(you)</span>}
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className={`text-[11px] font-mono uppercase ${p.isReady ? 'text-correct' : 'text-muted'}`}>
                        {p.isReady ? 'ready' : 'not ready'}
                      </span>
                      {isHost && p.userId !== user?.id && (
                        <button onClick={() => handleKick(p.userId)} className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer">
                          kick
                        </button>
                      )}
                    </span>
                  </div>
                ))}
                {Array.from({ length: empties }).map((_, i) => (
                  <div key={`slot-${t}-${i}`} className="flex items-center gap-2 py-2 text-sm text-muted border-b border-default">
                    <UserPlus size={13} />
                    <span className="italic">waiting…</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Finished summary */}
      {room.status === 'finished' && (
        <div className="border-t border-accent/40 pt-5 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent mb-2">Race finished</p>
          <h2 className="text-4xl font-extrabold tracking-tight mb-2">
            {room.winnerTeam
              ? `${TEAM_LABEL[room.winnerTeam]} wins${myPlayer && room.winnerTeam === myPlayer.team ? ' — you!' : ''}`
              : 'Dead heat'}
          </h2>
          {room.teamScores && (
            <p className="font-mono text-muted text-sm mb-2 tabular-nums">
              Team A {room.teamScores.A} — Team B {room.teamScores.B} <span className="text-xs">avg wpm</span>
            </p>
          )}
          {finalRank && <p className="text-sm text-muted">You placed <strong className="text-accent">#{finalRank}</strong> of {room.players.length}.</p>}
          <button onClick={handleLeave} className="btn-secondary mt-6 px-8 py-2.5 rounded-full font-bold cursor-pointer">
            Leave room
          </button>
        </div>
      )}
    </div>
  );
}
