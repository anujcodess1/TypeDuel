import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { reconnectSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/store/toast';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export function LoginPage() {
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ usernameOrEmail: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.auth.login(form);
      setUser(res.user);
      reconnectSocket();
      toast(`Welcome back, ${res.user.username}!`, 'success');
      navigate('/play');
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent mb-3">TypeDuel — access</p>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Welcome back.</h1>
          <p className="text-muted text-sm">Log in to duel, host rooms and climb the leaderboard.</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 py-2.5 px-3 border-y border-error text-sm text-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="usernameOrEmail" className="label">Username or email</label>
            <input
              id="usernameOrEmail"
              type="text"
              className="input"
              value={form.usernameOrEmail}
              onChange={e => setForm(f => ({ ...f, usernameOrEmail: e.target.value }))}
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="label">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                className="input pr-10"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="current-password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-[var(--text)] transition-colors"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-2.5 flex items-center justify-center gap-2" disabled={loading}>
            <LogIn size={15} />
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/auth/register" className="text-accent font-medium">Sign up</Link>
        </p>
      </div>
    </main>
  );
}
