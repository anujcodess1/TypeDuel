import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { getSocket, connectSocket } from '@/services/socket';
import { reauthSocket } from '@/services/api';
import { toast } from '@/store/toast';
import { TypingArea } from '@/components/TypingArea';
import { CountdownTimer } from '@/components/CountdownTimer';
import { Swords, X, Radar, Users, ShieldCheck, Zap } from 'lucide-react';

type Phase = 'config' | 'queue' | 'countdown' | 'active' | 'finished';

const QUEUE_STATUSES = [
  'Scanning the rated queue…',
  'Matching your difficulty and timer…',
  'Widening the Elo window…',
  'Pairing you with a fair opponent…',
];

export function DuelPage() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<Phase>(() => (searchParams.get('queue') ? 'queue' : 'config'));
  const [queueElapsed, setQueueElapsed] = useState(0);
  const [queueWaiting, setQueueWaiting] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>(() => {
    return (localStorage.getItem('typeduel_diff') as any) || 'normal';
  });
  const [duration, setDuration] = useState<number>(() => {
    return Number(localStorage.getItem('typeduel_dur')) || 60;
  });
  const [matchId, setMatchId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [opponent, setOpponent] = useState<{ username: string; elo: number } | null>(null);
  const [myProgress, setMyProgress] = useState(0);
  const [oppProgress, setOppProgress] = useState(0);
  const [oppWpm, setOppWpm] = useState(0);
  const [result, setResult] = useState<unknown>(null);
  const startTimeRef = useRef<number>(0);
  const keystrokesRef = useRef<{ char: string; index: number; correct: boolean; tsOffset: number }[]>([]);
  const progressThrottleRef = useRef<number>(0);

  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    socket.on('duel:matched', (data: {
      matchId: string;
      opponent: { player1: { id: string; username: string; elo: number }; player2: { id: string; username: string; elo: number } };
      countdownStartAt: number;
    }) => {
      setMatchId(data.matchId);
      const opp = data.opponent.player1.id === user?.id ? data.opponent.player2 : data.opponent.player1;
      setOpponent(opp);
      setCountdown(3);
      setPhase('countdown');
    });

    socket.on('duel:started', (data: { text: string; startedAt: number }) => {
      setText(data.text);
      setStartedAt(data.startedAt);
      startTimeRef.current = Date.now();
      keystrokesRef.current = [];
      setPhase('active');
    });

    socket.on('duel:opponent_progress', (data: { progress: number; wpm: number }) => {
      setOppProgress(data.progress);
      setOppWpm(data.wpm);
    });

    socket.on('duel:result', (data: unknown) => {
      setResult(data);
      setPhase('finished');
    });

    socket.on('duel:opponent_forfeited', () => {
      toast('Opponent disconnected — you win!', 'success');
      setPhase('finished');
    });

    socket.on('duel:queue_count', (data: { waiting: number }) => {
      setQueueWaiting(data.waiting);
    });

    return () => {
      socket.off('duel:matched');
      socket.off('duel:started');
      socket.off('duel:opponent_progress');
      socket.off('duel:result');
      socket.off('duel:opponent_forfeited');
      socket.off('duel:queue_count');
      socket.emit('duel:leave_queue');
    };
  }, [user?.id]);

  useEffect(() => {
    if (phase === 'queue') {
      setQueueElapsed(0);
      const t = setInterval(() => setQueueElapsed((e) => e + 1), 1000);
      return () => clearInterval(t);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'queue' && user) joinQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, user]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const interval = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  function joinQueue(retry = false) {
    setPhase('queue');
    setQueueWaiting(null);
    const socket = getSocket();
    socket.emit('duel:queue', { difficulty, duration }, (res: unknown) => {
      const r = res as { error?: string; queued?: boolean; matched?: boolean; waiting?: number };
      if (r.error) {
        if (!retry && /authentication required|not authenticated/i.test(r.error)) {
          void reauthSocket().then((ok) => {
            if (ok) joinQueue(true);
            else { toast('Your session expired — log in again', 'error'); setPhase('config'); }
          });
          return;
        }
        toast(r.error, 'error'); setPhase('config');
      }
      else if (r.queued) setQueueWaiting(r.waiting ?? 0);
    });
  }

  function cancelQueue() {
    const socket = getSocket();
    socket.emit('duel:leave_queue');
    setPhase('config');
  }

  const handleKeystroke = useCallback((char: string, index: number, correct: boolean) => {
    const tsOffset = Date.now() - startTimeRef.current;
    keystrokesRef.current.push({ char, index, correct, tsOffset });

    const progress = Math.round((index / (text.length || 1)) * 100);
    setMyProgress(progress);

    const now = Date.now();
    if (now - progressThrottleRef.current > 100) {
      progressThrottleRef.current = now;
      const socket = getSocket();
      const elapsed = tsOffset / 1000 / 60;
      const correct_count = keystrokesRef.current.filter(k => k.correct).length;
      const wpm = elapsed > 0 ? Math.round((correct_count / 5) / elapsed) : 0;
      socket.emit('duel:progress', { progress, wpm });
    }
  }, [text]);

  const handleFinish = useCallback(() => {
    const socket = getSocket();
    const ks = keystrokesRef.current;
    const elapsed = (Date.now() - startTimeRef.current) / 1000 / 60;
    const correct = ks.filter(k => k.correct).length;
    const total = ks.length;
    const netWpm = elapsed > 0 ? Math.round((correct / 5) / elapsed * 10) / 10 : 0;
    const rawWpm = elapsed > 0 ? Math.round((total / 5) / elapsed * 10) / 10 : 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 100;

    socket.emit('duel:finish', { netWpm, rawWpm, accuracy }, () => {});
  }, []);

  const handleTimeUp = useCallback(() => handleFinish(), [handleFinish]);

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono text-sm text-muted animate-pulse">Checking session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-4">
        <Swords size={40} className="text-accent mb-4" />
        <h1 className="text-2xl font-bold mb-3">1v1 Duel</h1>
        <p className="text-muted mb-6">Create an account to compete in rated duels and track your Elo rating.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('/auth/login')} className="btn-secondary">Log in</button>
          <button onClick={() => navigate('/auth/register')} className="btn-primary">Sign up</button>
        </div>
      </div>
    );
  }

  const r = result as {
    winnerId?: string;
    player1?: { userId: string; netWpm: number; accuracy: number; eloChange: number; newElo: number };
    player2?: { userId: string; netWpm: number; accuracy: number; eloChange: number; newElo: number };
  } | null;

  const myResult = r ? (r.player1?.userId === user.id ? r.player1 : r.player2) : null;
  const isWinner = r?.winnerId === user.id;

  return (
    <div className="flex-1 min-h-0 w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-col justify-center">
      {phase === 'config' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <Swords size={24} className="text-accent" />
            <h1 className="text-2xl font-bold">1v1 Duel</h1>
            <span className="badge badge-accent text-xs">Rated</span>
          </div>

          <div className="border-y border-default py-5">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-default">
              <div>
                <p className="font-medium">{user.username}</p>
                <p className="text-sm text-muted">Elo: <span className="text-accent font-semibold">{user.elo}</span></p>
              </div>
              <Swords size={20} className="text-muted" />
              <div className="text-right">
                <p className="font-medium text-muted">vs. Opponent</p>
                <p className="text-sm text-muted">Picked by matchmaking</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="label">Difficulty</p>
              <div className="flex gap-2">
                {(['easy', 'normal', 'hard'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-4 py-2 rounded text-sm font-medium border transition-all ${
                      difficulty === d ? 'border-accent text-accent bg-accent/8' : 'border-default text-muted hover:text-[var(--text)]'
                    }`}
                    aria-pressed={difficulty === d}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <p className="label">Duration</p>
              <div className="flex gap-2">
                {[15, 30, 60, 120].map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-4 py-2 rounded text-sm font-medium border transition-all ${
                      duration === d ? 'border-accent text-accent bg-accent/8' : 'border-default text-muted hover:text-[var(--text)]'
                    }`}
                    aria-pressed={duration === d}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => joinQueue()} className="btn-primary w-full py-3">
              Find Opponent
            </button>
          </div>
        </div>
      )}

      {phase === 'queue' && (
        <div className="animate-fade-in flex flex-col items-center justify-center gap-6">
          {/* Matchmaking radar */}
          <div className="relative flex items-center justify-center w-40 h-40">
            <div className="absolute inset-0 rounded-full border border-accent/25" />
            <div className="absolute inset-6 rounded-full border border-accent/30" />
            <div className="absolute inset-12 rounded-full border border-accent/40" />
            <div className="absolute inset-0 rounded-full bg-accent/15 animate-ring-slow" />
            <div
              className="absolute inset-0 animate-orbit"
              style={{ animationDuration: '4.5s' }}
              aria-hidden="true"
            >
              <span className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[var(--surface)] border border-accent/50 text-accent text-[10px] font-bold flex items-center justify-center">
                ?
              </span>
            </div>
            <div
              className="absolute inset-0 animate-orbit"
              style={{ animationDuration: '8s', animationDirection: 'reverse' }}
              aria-hidden="true"
            >
              <span className="absolute top-7 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[var(--raised)] border border-default text-muted text-[10px] font-bold flex items-center justify-center">
                ?
              </span>
            </div>
            <div className="relative w-20 h-20 rounded-full bg-accent/15 border-2 border-accent text-accent flex flex-col items-center justify-center">
              <Radar size={22} className="animate-pulse" />
              <span className="font-mono text-xs font-bold mt-0.5 tabular-nums">{queueElapsed}s</span>
            </div>
          </div>

          <div className="text-center space-y-1.5 max-w-sm">
            <h2 className="text-2xl font-bold tracking-tight">Finding your opponent…</h2>
            <p className="text-muted text-sm min-h-[1.25rem]">
              {QUEUE_STATUSES[Math.floor(queueElapsed / 3) % QUEUE_STATUSES.length]}
            </p>
            <p className="text-xs text-muted flex items-center justify-center gap-1.5">
              <Users size={12} className="text-accent" />
              {queueWaiting === null
                ? 'Joining the rated queue…'
                : queueWaiting <= 1
                  ? 'You are the only typer waiting in this pool'
                  : <><span className="font-mono tabular-nums">{queueWaiting - 1}</span> other{queueWaiting - 1 === 1 ? '' : 's'} waiting in the queue</>}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="badge badge-accent capitalize">{difficulty}</span>
            <span className="badge badge-accent">{duration}s race</span>
            <span className="badge border border-default text-muted flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-correct" /> Fair match · Elo {user.elo}
            </span>
          </div>

          <button onClick={cancelQueue} className="btn-secondary flex items-center gap-2 px-6 py-2.5 rounded-full text-sm cursor-pointer">
            <X size={15} /> Cancel Search
          </button>
        </div>
      )}

      {phase === 'countdown' && opponent && (
        <div className="animate-fade-in flex flex-col items-center justify-center gap-5">
          <span className="badge badge-correct text-xs uppercase tracking-widest animate-scale-in">
            <Zap size={12} fill="currentColor" /> Match found
          </span>

          <div className="border-y border-default py-6 w-full max-w-xl">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
              <div className="text-center animate-fade-up">
                <div className="w-16 h-16 rounded-full bg-accent/10 ring-2 ring-accent/40 flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl font-bold text-accent">{user.username[0]?.toUpperCase()}</span>
                </div>
                <p className="font-bold truncate">{user.username}</p>
                <p className="text-xs text-muted">Elo {user.elo} · You</p>
              </div>
              <div className="text-2xl font-black text-muted/60 select-none">VS</div>
              <div className="text-center animate-fade-up delay-150">
                <div className="w-16 h-16 rounded-full bg-[var(--raised)] ring-2 ring-default flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl font-bold text-muted">{opponent.username[0]?.toUpperCase()}</span>
                </div>
                <p className="font-bold truncate">{opponent.username}</p>
                <p className="text-xs text-muted">Elo {opponent.elo}</p>
              </div>
            </div>

            <div className="flex flex-col items-center mt-5 gap-1">
              <div
                key={countdown}
                className="animate-scale-in text-6xl font-black font-mono text-accent tabular-nums leading-none"
                aria-live="polite"
              >
                {countdown > 0 ? countdown : 'GO!'}
              </div>
              <p className="text-muted text-sm">Get ready — hands on the keys…</p>
            </div>

            <div className="flex items-center justify-center gap-3 mt-5 pt-4 border-t border-default">
              <span className="badge badge-accent capitalize">{difficulty}</span>
              <span className="badge badge-accent">{duration}s</span>
            </div>
          </div>
        </div>
      )}

      {phase === 'active' && (
        <div className="animate-fade-in">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">{user.username} (you)</p>
              <CountdownTimer duration={duration} isActive onTimeUp={handleTimeUp} />
              <p className="text-sm font-medium">{opponent?.username}</p>
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>{myProgress}%</span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${myProgress}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>{oppProgress}%</span>
                  <span>{oppWpm} wpm</span>
                </div>
                <div className="progress-bar-track">
                  <div className="h-full rounded" style={{ width: `${oppProgress}%`, background: 'var(--muted)' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-default pt-5">
            <TypingArea
              text={text}
              onKeystroke={handleKeystroke}
              onFinish={handleFinish}
              isActive
            />
          </div>
        </div>
      )}

      {phase === 'finished' && (
        <div className="animate-scale-in text-center">
          <div className={`text-5xl mb-3 ${isWinner ? '' : 'grayscale opacity-60'}`}>
            {isWinner ? '🏆' : '😞'}
          </div>
          <h2 className="text-3xl font-bold mb-2">{isWinner ? 'Victory!' : r?.winnerId ? 'Defeat' : 'Draw'}</h2>
          {myResult && (
            <div className="grid grid-cols-2 border-y border-default mt-6 mb-6 max-w-sm mx-auto">
              <div className="py-4 text-center">
                <p className="font-mono text-3xl font-extrabold text-accent tabular-nums">{myResult.netWpm}</p>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mt-1">Your WPM</p>
              </div>
              <div className="py-4 text-center border-l border-default">
                <p className="font-mono text-3xl font-extrabold tabular-nums">{myResult.accuracy}%</p>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mt-1">Accuracy</p>
              </div>
              <div className="py-4 text-center col-span-2 border-t border-default">
                <p className={`font-mono text-3xl font-extrabold tabular-nums ${myResult.eloChange > 0 ? 'text-correct' : 'text-error'}`}>
                  {myResult.eloChange > 0 ? '+' : ''}{myResult.eloChange}
                </p>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mt-1">Elo Change (now {myResult.newElo})</p>
              </div>
            </div>
          )}
          <button onClick={() => setPhase('config')} className="btn-primary px-8 cursor-pointer">
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
