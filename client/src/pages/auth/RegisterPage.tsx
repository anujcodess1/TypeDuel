import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { reconnectSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/store/toast';
import { Eye, EyeOff, Check, X, Zap } from 'lucide-react';

function PasswordRule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${ok ? 'text-correct' : 'text-muted'}`}>
      {ok ? <Check size={12} /> : <X size={12} />}
      {text}
    </li>
  );
}

const COMMON = new Set([
  'password123', 'qwerty123', '123456789', 'password1', 'letmein1',
  'welcome123', 'monkey123', 'dragon123', 'master123', 'abc123456',
  'password1234', 'qwerty12345', 'iloveyou123', 'admin12345', 'trustno123',
  '111111111111', 'aaaaaaaaaaaa', 'passw0rd123', 'changeme123', 'samsung123',
]);

export function RegisterPage() {
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const pw = form.password;
  const pwRules = {
    length: pw.length >= 12,
    classes: [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(pw)).length >= 3,
    notCommon: pw.length > 0 && !COMMON.has(pw.toLowerCase()) && !/^\d+$/.test(pw),
    notUsername: pw.length > 0 && (form.username.length < 3 || !pw.toLowerCase().includes(form.username.toLowerCase())),
  };
  const pwOk = pwRules.length && pwRules.classes && pwRules.notCommon && pwRules.notUsername;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!pwOk) { setError('Password does not meet all requirements below'); return; }
    setLoading(true);
    try {
      const res = await api.auth.register(form);
      setUser(res.user);
      reconnectSocket();
      toast(`Welcome to TypeDuel, ${res.user.username}!`, 'success');
      navigate('/play');
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent mb-3">TypeDuel — new typers</p>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Claim your handle.</h1>
          <p className="text-muted text-sm">Join the leaderboard and start competing.</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 py-2.5 px-3 border-y border-error text-sm text-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="username" className="label">Username</label>
            <input
              id="username"
              type="text"
              className="input"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoComplete="username"
              minLength={3}
              maxLength={20}
              required
              disabled={loading}
              placeholder="3–20 characters, your arena name"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-2">
            <label htmlFor="reg-password" className="label">Password</label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPw ? 'text' : 'password'}
                className="input pr-10"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
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

          {pw.length > 0 && (
            <ul className="mb-4 pl-1 space-y-1">
              <PasswordRule ok={pwRules.length} text="At least 12 characters" />
              <PasswordRule ok={pwRules.classes} text="Mix of lowercase, uppercase, digits, symbols (3 of 4)" />
              <PasswordRule ok={pwRules.notCommon} text="Not a common or all-digit password" />
              <PasswordRule ok={pwRules.notUsername} text="Does not contain your username" />
            </ul>
          )}

          <button type="submit" className="btn-primary w-full py-2.5 mt-2 flex items-center justify-center gap-2" disabled={loading}>
            <Zap size={15} />
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-accent font-medium">Log in</Link>
        </p>

        <p className="text-center text-xs text-muted mt-3">
          By registering you agree to our{' '}
          <Link to="/terms" className="text-muted hover:text-accent no-underline transition-colors">Terms of Service</Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-muted hover:text-accent no-underline transition-colors">Privacy Policy</Link>
        </p>
      </div>
    </main>
  );
}
