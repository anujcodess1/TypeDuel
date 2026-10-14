import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/auth';

interface LeaderboardRow {
  id: string;
  user_id: string;
  username: string;
  net_wpm: number;
  accuracy: number;
  created_at: string;
  rank: number;
}

const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
const DURATIONS = [15, 30, 60, 120] as const;
const PERIODS = ['daily', 'weekly', 'all'] as const;

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-500 font-bold text-base">🥇</span>;
  if (rank === 2) return <span className="text-gray-400 font-bold text-base">🥈</span>;
  if (rank === 3) return <span className="text-amber-700 font-bold text-base">🥉</span>;
  return <span className="text-muted font-mono text-sm">{rank}</span>;
}

export function LeaderboardPage() {
  const user = useAuthStore((s) => s.user);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [duration, setDuration] = useState<number>(60);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'all'>('all');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(cursor?: string) {
    if (!cursor) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await api.leaderboard.get({ difficulty, duration, period, cursor });
      const data = res as { rows: LeaderboardRow[]; nextCursor: string | null };
      setRows(prev => cursor ? [...prev, ...data.rows] : data.rows);
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    setRows([]);
    load();
  }, [difficulty, duration, period]);

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
      </div>

      <div className="surface mb-6">
        <div className="tab-bar">
          {PERIODS.map(p => (
            <button
              key={p}
              className={`tab-item ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
              aria-selected={period === p}
              role="tab"
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-4 flex flex-wrap gap-4 border-b border-default">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Mode:</span>
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
                  difficulty === d ? 'border-accent text-accent bg-accent/8' : 'border-default text-muted hover:text-[var(--text)]'
                }`}
                aria-pressed={difficulty === d}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Timer:</span>
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
                  duration === d ? 'border-accent text-accent bg-accent/8' : 'border-default text-muted hover:text-[var(--text)]'
                }`}
                aria-pressed={duration === d}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <p className="text-4xl mb-3">🏆</p>
            <p className="font-medium">No results yet</p>
            <p className="text-sm">Be the first to set a score!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Leaderboard">
              <thead>
                <tr className="border-b border-default text-left">
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider w-12">#</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">Player</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider text-right">WPM</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider text-right">Accuracy</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider text-right hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isCurrentUser = user?.id === row.user_id;
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-default transition-colors ${
                        isCurrentUser ? 'bg-accent/5' : 'hover:bg-[var(--raised)]'
                      }`}
                      aria-label={isCurrentUser ? 'Your result' : undefined}
                    >
                      <td className="py-3 px-4">
                        <RankBadge rank={row.rank ?? i + 1} />
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-medium ${isCurrentUser ? 'text-accent' : ''}`}>
                          {row.username}
                          {isCurrentUser && <span className="ml-1.5 text-xs text-accent">(you)</span>}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                        {row.net_wpm}
                      </td>
                      <td className="py-3 px-4 text-right text-muted font-mono tabular-nums">
                        {row.accuracy}%
                      </td>
                      <td className="py-3 px-4 text-right text-muted text-sm hidden sm:table-cell">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {nextCursor && (
          <div className="p-4 text-center border-t border-default">
            <button
              onClick={() => load(nextCursor)}
              className="btn-secondary"
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
