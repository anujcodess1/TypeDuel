import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/services/api';
import { Link, Navigate } from 'react-router-dom';
import { User, Trophy, Crosshair, Shield, LogOut, Trash2, Key, Monitor } from 'lucide-react';
import { toast } from '@/store/toast';
import { Suspense, lazy } from 'react';

const ResultChart = lazy(() => import('@/components/ResultChart'));

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<unknown>(null);
  const [sessions, setSessions] = useState<{ id: string; device_info?: string; ip?: string; last_seen_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'sessions' | 'security'>('overview');
  const [changePw, setChangePw] = useState({ currentPassword: '', newPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.leaderboard.me(),
      api.auth.sessions(),
    ]).then(([p, s]) => {
      setProfile(p);
      const sRes = s as { sessions: typeof sessions };
      setSessions(sRes.sessions);
    }).finally(() => setLoading(false));
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwLoading(true);
    try {
      await api.auth.changePassword(changePw);
      toast('Password changed. Please log in again.', 'success');
      logout();
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
    } finally {
      setPwLoading(false);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    await api.auth.revokeSession(sessionId);
    setSessions(s => s.filter(sess => sess.id !== sessionId));
    toast('Session revoked', 'success');
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteLoading(true);
    try {
      await api.auth.deleteAccount({ password: deleteConfirm });
      logout();
      toast('Account deleted', 'success');
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  }

  const p = profile as {
    username?: string;
    elo?: number;
    provisional_games?: number;
    created_at?: string;
    stats?: {
      tests_taken?: number;
      best_wpm?: number | null;
      avg_accuracy?: number | null;
      wins?: number;
      losses?: number;
    };
    eloHistory?: { elo: number; created_at: string }[];
  } | null;

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono text-sm text-muted animate-pulse">Checking session…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth/login" replace />;

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
          <User size={24} className="text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.username}</h1>
          <p className="text-muted text-sm">
            {p?.provisional_games !== undefined && p.provisional_games < 10 ? (
              <span className="badge badge-accent">Provisional ({p.provisional_games}/10)</span>
            ) : (
              <span>Elo: <strong className="text-accent">{p?.elo ?? user.elo}</strong></span>
            )}
          </p>
        </div>
      </div>

      <div className="tab-bar mb-6">
        {(['overview', 'sessions', 'security'] as const).map(t => (
          <button
            key={t}
            className={`tab-item ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
            aria-selected={tab === t}
            role="tab"
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 w-full" />)}
        </div>
      ) : (
        <>
          {tab === 'overview' && (
            <div className="animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Tests Taken', value: p?.stats?.tests_taken ?? 0, icon: <Crosshair size={16} /> },
                  { label: 'Best WPM', value: p?.stats?.best_wpm?.toFixed(1) ?? '—', icon: <Trophy size={16} /> },
                  { label: 'Avg Accuracy', value: p?.stats?.avg_accuracy ? `${p.stats.avg_accuracy.toFixed(1)}%` : '—', icon: <Shield size={16} /> },
                  { label: 'Win / Loss', value: `${p?.stats?.wins ?? 0} / ${p?.stats?.losses ?? 0}`, icon: <Trophy size={16} /> },
                ].map(stat => (
                  <div key={stat.label} className="stat-card">
                    <div className="flex items-center gap-2 mb-2 text-muted">{stat.icon}<p className="stat-label">{stat.label}</p></div>
                    <p className="stat-value text-accent">{String(stat.value)}</p>
                  </div>
                ))}
              </div>

              {(p?.eloHistory?.length ?? 0) > 1 && (
                <div className="surface p-4 mb-6">
                  <p className="text-sm font-semibold text-muted mb-4">Elo History</p>
                  <Suspense fallback={<div className="skeleton h-40 w-full" />}>
                    <ResultChart
                      data={(p?.eloHistory ?? []).map((e, i) => ({ second: i + 1, wpm: e.elo }))}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          )}

          {tab === 'sessions' && (
            <div className="animate-fade-in surface overflow-hidden">
              <div className="p-4 border-b border-default">
                <p className="font-semibold">Active Sessions</p>
                <p className="text-sm text-muted mt-1">Manage devices where you're logged in</p>
              </div>
              {sessions.length === 0 ? (
                <p className="p-6 text-center text-muted">No sessions found</p>
              ) : (
                <ul>
                  {sessions.map(sess => (
                    <li key={sess.id} className="flex items-center justify-between p-4 border-b border-default last:border-0">
                      <div className="flex items-center gap-3">
                        <Monitor size={16} className="text-muted flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">
                            {sess.device_info?.split('(')[0]?.trim() ?? 'Unknown device'}
                          </p>
                          <p className="text-xs text-muted">Last seen {new Date(sess.last_seen_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeSession(sess.id)}
                        className="btn-ghost text-error text-sm px-2 py-1"
                        aria-label="Revoke session"
                      >
                        Revoke
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="p-4 border-t border-default">
                <button
                  onClick={async () => { await api.auth.logoutAll(); logout(); }}
                  className="btn-danger w-full flex items-center justify-center gap-2"
                >
                  <LogOut size={14} /> Log out all devices
                </button>
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div className="animate-fade-in space-y-6">
              <div className="surface p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Key size={16} className="text-accent" />
                  <h2 className="font-semibold">Change Password</h2>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="label" htmlFor="cur-pw">Current password</label>
                    <input
                      id="cur-pw"
                      type="password"
                      className="input"
                      value={changePw.currentPassword}
                      onChange={e => setChangePw(f => ({ ...f, currentPassword: e.target.value }))}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="new-pw">New password</label>
                    <input
                      id="new-pw"
                      type="password"
                      className="input"
                      value={changePw.newPassword}
                      onChange={e => setChangePw(f => ({ ...f, newPassword: e.target.value }))}
                      required
                      minLength={10}
                      autoComplete="new-password"
                    />
                  </div>
                  <button type="submit" className="btn-primary" disabled={pwLoading}>
                    {pwLoading ? 'Saving...' : 'Change password'}
                  </button>
                </form>
              </div>

              <div className="surface p-6 border-error/30">
                <div className="flex items-center gap-2 mb-4">
                  <Trash2 size={16} className="text-error" />
                  <h2 className="font-semibold text-error">Delete Account</h2>
                </div>
                <p className="text-sm text-muted mb-4">
                  This action is permanent and cannot be undone. All your data will be removed.
                </p>
                <form onSubmit={handleDeleteAccount} className="space-y-4">
                  <div>
                    <label className="label" htmlFor="del-confirm">Confirm with your password</label>
                    <input
                      id="del-confirm"
                      type="password"
                      className="input border-error/50"
                      value={deleteConfirm}
                      onChange={e => setDeleteConfirm(e.target.value)}
                      required
                      placeholder="Enter your password"
                    />
                  </div>
                  <button type="submit" className="btn-danger" disabled={deleteLoading}>
                    {deleteLoading ? 'Deleting...' : 'Delete my account'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
