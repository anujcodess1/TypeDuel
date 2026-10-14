import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TypingArea } from '@/components/TypingArea';
import { CountdownTimer } from '@/components/CountdownTimer';
import { getSocket, connectSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/store/toast';
import { Play, RotateCcw, RefreshCw, Zap, ShieldCheck } from 'lucide-react';
import { lazy, Suspense } from 'react';

const ResultChart = lazy(() => import('@/components/ResultChart'));

type Difficulty = 'easy' | 'normal' | 'hard';
type Duration = 15 | 30 | 60 | 120;

interface SoloResult {
  netWpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  correctChars: number;
  incorrectChars: number;
  wpmOverTime: { second: number; wpm: number }[];
}

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
const DURATIONS: Duration[] = [15, 30, 60, 120];

export function SoloPage() {
  const user = useAuthStore((s) => s.user);

  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    return (localStorage.getItem('typeduel_diff') as Difficulty) || 'normal';
  });
  const [duration, setDuration] = useState<Duration>(() => {
    return Number(localStorage.getItem('typeduel_dur')) as Duration || 60;
  });

  const [phase, setPhase] = useState<'idle' | 'active' | 'finished'>('idle');
  const [text, setText] = useState('');
  const [result, setResult] = useState<SoloResult | null>(null);

  const [liveWpm, setLiveWpm] = useState(0);
  const [liveAccuracy, setLiveAccuracy] = useState(100);
  const [liveErrors, setLiveErrors] = useState(0);

  const sessionIdRef = useRef<string | null>(null);
  const keystrokesRef = useRef<{ char: string; index: number; correct: boolean; tsOffset: number }[]>([]);
  const startTimeRef = useRef<number>(0);
  const statsRafRef = useRef<number>(0);
  const pendingKeystrokes = useRef<typeof keystrokesRef.current>([]);

  const fetchNewParagraph = useCallback((diff: Difficulty, dur: Duration, autoStart = false) => {
    const socket = getSocket();
    connectSocket();
    socket.emit('solo:start', { difficulty: diff, duration: dur }, (res: unknown) => {
      const r = res as { text?: string; sessionId?: string; error?: string };
      if (r.error) {
        toast(r.error, 'error');
        return;
      }
      setText(r.text || '');
      sessionIdRef.current = r.sessionId || null;
      keystrokesRef.current = [];
      pendingKeystrokes.current = [];
      setLiveWpm(0);
      setLiveAccuracy(100);
      setLiveErrors(0);
      setResult(null);

      if (autoStart) {
        startTimeRef.current = Date.now();
        setPhase('active');
      } else {
        setPhase('idle');
      }
    });
  }, []);

  useEffect(() => {
    fetchNewParagraph(difficulty, duration, false);
  }, []);

  const handleSelectDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    localStorage.setItem('typeduel_diff', d);
    fetchNewParagraph(d, duration, false);
  };

  const handleSelectDuration = (dur: Duration) => {
    setDuration(dur);
    localStorage.setItem('typeduel_dur', String(dur));
    fetchNewParagraph(difficulty, dur, false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'idle') {
        e.preventDefault();
        fetchNewParagraph(difficulty, duration, false);
      }
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        fetchNewParagraph(difficulty, duration, true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, difficulty, duration, fetchNewParagraph]);

  const updateStats = useCallback(() => {
    const ks = keystrokesRef.current;
    const elapsed = (Date.now() - startTimeRef.current) / 1000 / 60;
    const correct = ks.filter((k) => k.correct).length;
    const total = ks.length;
    const wpm = elapsed > 0 ? Math.round(correct / 5 / elapsed) : 0;
    const acc = total > 0 ? Math.round((correct / total) * 100) : 100;
    const errors = total - correct;
    setLiveWpm(wpm);
    setLiveAccuracy(acc);
    setLiveErrors(errors);
  }, []);

  const handleKeystroke = useCallback(
    (char: string, index: number, correct: boolean) => {
      if (phase === 'idle') {
        startTimeRef.current = Date.now();
        setPhase('active');
      }

      const tsOffset = Date.now() - (startTimeRef.current || Date.now());
      const ks = { char, index, correct, tsOffset };
      keystrokesRef.current.push(ks);
      pendingKeystrokes.current.push(ks);

      if (pendingKeystrokes.current.length >= 10) {
        const socket = getSocket();
        socket.emit('solo:keystroke', {
          keystrokes: pendingKeystrokes.current,
          sessionId: sessionIdRef.current,
        });
        pendingKeystrokes.current = [];
      }

      cancelAnimationFrame(statsRafRef.current);
      statsRafRef.current = requestAnimationFrame(updateStats);
    },
    [phase, updateStats],
  );

  const handleTabBlur = useCallback(() => {
    const socket = getSocket();
    socket.emit('solo:tab_blur');
  }, []);

  useEffect(() => {
    if (phase === 'active') {
      window.addEventListener('blur', handleTabBlur);
    }
    return () => window.removeEventListener('blur', handleTabBlur);
  }, [phase, handleTabBlur]);

  const handleFinish = useCallback(() => {
    cancelAnimationFrame(statsRafRef.current);
    if (pendingKeystrokes.current.length > 0) {
      const socket = getSocket();
      socket.emit('solo:keystroke', {
        keystrokes: pendingKeystrokes.current,
        sessionId: sessionIdRef.current,
      });
      pendingKeystrokes.current = [];
    }

    const socket = getSocket();
    socket.emit('solo:finish', { sessionId: sessionIdRef.current }, (res: unknown) => {
      const r = res as { score?: SoloResult; error?: string; flagged?: boolean };
      if (r.error) {
        toast(r.error, 'error');
        fetchNewParagraph(difficulty, duration, false);
        return;
      }
      if (r.flagged) toast('Result flagged — not saved to leaderboard', 'error');
      setResult(r.score!);
      setPhase('finished');
    });
  }, [difficulty, duration, fetchNewParagraph]);

  const handleTimeUp = useCallback(() => {
    handleFinish();
  }, [handleFinish]);

  const handleStartPlay = () => {
    startTimeRef.current = Date.now();
    setPhase('active');
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col justify-center max-w-5xl w-full mx-auto px-4 sm:px-6 py-4">
      {/* Top Bar: Clean Action Center with Customize & Play Controls */}
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-default">
        <div className="flex items-center gap-3">
          {phase === 'idle' ? (
            <button
              onClick={handleStartPlay}
              className="btn-primary flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-sm shadow-sm transition-transform active:scale-95"
            >
              <Play size={15} fill="currentColor" /> Play
            </button>
          ) : (
            <button
              onClick={() => fetchNewParagraph(difficulty, duration, true)}
              className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold shadow-sm text-muted hover:text-[var(--text)] transition-transform active:scale-95"
              title="Restart test (Shift + Tab)"
            >
              <RotateCcw size={14} /> Restart
            </button>
          )}
        </div>

        {phase === 'active' && (
          <div className="flex items-center gap-6 animate-fade-in">
            <div className="flex items-center gap-5 font-mono text-sm">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-muted font-sans font-medium uppercase tracking-wider">WPM</span>
                <span className="text-xl font-bold text-accent tabular-nums leading-none">{liveWpm}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-muted font-sans font-medium uppercase tracking-wider">ACC</span>
                <span className="text-xl font-bold text-[var(--text)] tabular-nums leading-none">{liveAccuracy}%</span>
              </div>
            </div>

            <div className="pl-3 border-l border-default/40">
              <CountdownTimer duration={duration} isActive={phase === 'active'} onTimeUp={handleTimeUp} />
            </div>
          </div>
        )}
      </div>

      {phase === 'idle' && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Words</span>
            <div className="flex border-y border-default divide-x divide-default">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => handleSelectDifficulty(d)}
                  className={`px-4 py-1.5 font-mono text-xs uppercase tracking-wider cursor-pointer transition-colors ${
                    difficulty === d ? 'text-accent font-bold bg-accent/5' : 'text-muted hover:text-[var(--text)]'
                  }`}
                  aria-pressed={difficulty === d}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Timer</span>
            <div className="flex border-y border-default divide-x divide-default">
              {DURATIONS.map((dur) => (
                <button
                  key={dur}
                  onClick={() => handleSelectDuration(dur)}
                  className={`px-4 py-1.5 font-mono text-xs cursor-pointer transition-colors ${
                    duration === dur ? 'text-accent font-bold bg-accent/5' : 'text-muted hover:text-[var(--text)]'
                  }`}
                  aria-pressed={duration === dur}
                >
                  {dur}s
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Typing Arena */}
      {phase !== 'finished' ? (
        <div className="relative">
          <div className="min-h-[170px] flex items-center">
            {text ? (
              <TypingArea
                text={text}
                onKeystroke={handleKeystroke}
                onFinish={handleFinish}
                isActive={true}
              />
            ) : (
              <div className="w-full flex items-center justify-center py-16 text-muted font-mono animate-pulse">
                Loading...
              </div>
            )}
          </div>

          {/* Discreet Footer Action Hint */}
          <div className="mt-5 pt-3 flex items-center justify-between text-xs text-muted border-t border-default">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-correct inline-block" />
              <span>Type any key or click Play to begin</span>
            </span>

            <div className="flex items-center gap-1.5 text-muted">
              <ShieldCheck size={14} className="text-correct" />
              <span>Anti-cheat verified</span>
            </div>
          </div>
        </div>
      ) : (
        result && (
          <div className="animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <div>
                <span className="text-xs font-semibold text-accent uppercase tracking-widest">Test Complete</span>
                <h2 className="text-2xl font-extrabold tracking-tight mt-0.5">Your Performance</h2>
              </div>
              <button
                onClick={() => fetchNewParagraph(difficulty, duration, true)}
                className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold cursor-pointer"
              >
                <RefreshCw size={15} /> Play Again
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 border-y border-default mb-6">
              <div className="py-4 px-1">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Net Speed</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold font-mono text-accent">{result.netWpm}</span>
                  <span className="text-sm font-semibold text-muted">WPM</span>
                </div>
              </div>

              <div className="py-4 px-1 border-l border-default">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Accuracy</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold font-mono text-[var(--text)]">{result.accuracy}</span>
                  <span className="text-sm font-semibold text-muted">%</span>
                </div>
              </div>

              <div className="py-4 px-1 sm:border-l border-default">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Raw Speed</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold font-mono text-muted">{result.rawWpm}</span>
                  <span className="text-sm font-semibold text-muted">WPM</span>
                </div>
              </div>

              <div className="py-4 px-1 border-l border-default">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Consistency</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold font-mono text-[var(--text)]">{result.consistency}</span>
                  <span className="text-sm font-semibold text-muted">%</span>
                </div>
              </div>
            </div>

            <div className="border-b border-default pb-5">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">WPM Speed Over Time</p>
              <div className="h-40 w-full">
                <Suspense fallback={<div className="h-full w-full bg-[var(--raised)] rounded-lg animate-pulse" />}>
                  <ResultChart data={result.wpmOverTime} />
                </Suspense>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
