import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Keyboard, Sun, Moon, Menu, X, User, LogOut } from 'lucide-react';
import { useThemeStore } from '@/store/theme';
import { useAuthStore } from '@/store/auth';
import { api } from '@/services/api';
import { disconnectSocket } from '@/services/socket';
import { toast } from '@/store/toast';

const APP_NAME = 'TypeDuel';

export function Navbar() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isGuest = useAuthStore((s) => s.isGuest);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.auth.logout();
    } catch {}
    logout();
    disconnectSocket();
    navigate('/');
    toast('Logged out', 'success');
  }

  return (
    <nav className="z-50 border-b border-default bg-surface" aria-label="Main navigation">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-lg text-[var(--text)] no-underline hover:no-underline"
          aria-label={`${APP_NAME} — Home`}
        >
          <Keyboard size={20} className="text-accent" />
          <span>{APP_NAME}</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="btn-ghost p-2 rounded"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {user ? (
            <div className="hidden md:flex items-center gap-2">
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors no-underline ${
                    isActive ? 'text-accent' : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`
                }
              >
                <User size={14} />
                {user.username}
              </NavLink>
              <button onClick={handleLogout} className="btn-ghost p-2 rounded" aria-label="Log out">
                <LogOut size={14} />
              </button>
            </div>
          ) : isGuest ? (
            <div className="hidden md:flex items-center gap-2">
              <Link to="/auth/login" className="btn-secondary text-sm px-3 py-1.5">Log in</Link>
              <Link to="/auth/register" className="btn-primary text-sm px-3 py-1.5">Sign up</Link>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link to="/auth/login" className="btn-secondary text-sm px-3 py-1.5">Log in</Link>
              <Link to="/auth/register" className="btn-primary text-sm px-3 py-1.5">Sign up</Link>
            </div>
          )}

          <button
            className="md:hidden btn-ghost p-2 rounded"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-default bg-surface px-4 py-3 flex flex-col gap-2 animate-slide-up">
          {user ? (
            <>
              <NavLink to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded text-sm no-underline text-[var(--text)]">
                <User size={14} /> {user.username}
              </NavLink>
              <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="flex items-center gap-2 px-3 py-2 rounded text-sm text-[var(--muted)] text-left">
                <LogOut size={14} /> Log out
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Link to="/auth/login" onClick={() => setMenuOpen(false)} className="btn-secondary">Log in</Link>
              <Link to="/auth/register" onClick={() => setMenuOpen(false)} className="btn-primary">Sign up</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
