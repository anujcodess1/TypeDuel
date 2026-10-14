import React from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Keyboard, Sun, Moon } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ToastContainer } from '@/components/ToastContainer';
import { useThemeStore } from '@/store/theme';
import { useAuthStore } from '@/store/auth';
import { useRouteKey } from '@/hooks/useRouteKey';
import { LandingPage } from '@/pages/LandingPage';
import { SoloPage } from '@/pages/SoloPage';
import { DuelPage } from '@/pages/DuelPage';
import { RoomPage } from '@/pages/RoomPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { AboutPage } from '@/pages/static/AboutPage';
import { FAQPage } from '@/pages/static/FAQPage';
import { ContactPage } from '@/pages/static/ContactPage';
import { LegalPages } from '@/pages/static/LegalPages';

const GAME_LABELS: Record<string, string> = {
  '/play': 'Practice',
  '/duel': 'Ranked Duel',
  '/room': 'Team Room',
};

function GameBar() {
  const { pathname } = useLocation();
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const user = useAuthStore((s) => s.user);
  const label = Object.entries(GAME_LABELS).find(([p]) => pathname.startsWith(p))?.[1] ?? 'Game';

  return (
    <header className="h-12 shrink-0 border-b border-default bg-surface">
      <div className="h-full max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="flex items-center gap-2.5 no-underline text-[var(--text)]"
          aria-label="Back to home"
        >
          <ArrowLeft size={16} className="text-muted" />
          <Keyboard size={16} className="text-accent" />
          <span className="font-bold">TypeDuel</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted border-l border-default pl-2.5 ml-1">
            {label}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {user && <span className="font-mono text-xs text-muted hidden sm:inline">{user.username}</span>}
          <button
            onClick={toggle}
            className="btn-ghost p-1.5 rounded"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Keyed({ children }: { children: React.ReactNode }) {
  useRouteKey();
  return <>{children}</>;
}

const routes = (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/play/:key?" element={<Keyed><SoloPage /></Keyed>} />
    <Route path="/duel/:key?" element={<Keyed><DuelPage /></Keyed>} />
    <Route path="/room/:key?" element={<Keyed><RoomPage /></Keyed>} />
    <Route path="/leaderboard/:key?" element={<Keyed><LeaderboardPage /></Keyed>} />
    <Route path="/profile/:key?" element={<Keyed><ProfilePage /></Keyed>} />

    {/* Auth */}
    <Route path="/auth/login/:key?" element={<Keyed><LoginPage /></Keyed>} />
    <Route path="/auth/register/:key?" element={<Keyed><RegisterPage /></Keyed>} />

    {/* Info & Static */}
    <Route path="/about/:key?" element={<Keyed><AboutPage /></Keyed>} />
    <Route path="/faq/:key?" element={<Keyed><FAQPage /></Keyed>} />
    <Route path="/contact/:key?" element={<Keyed><ContactPage /></Keyed>} />

    {/* Legal */}
    <Route path="/terms/:key?" element={<Keyed><LegalPages type="terms" /></Keyed>} />
    <Route path="/privacy/:key?" element={<Keyed><LegalPages type="privacy" /></Keyed>} />
    <Route path="/license/:key?" element={<Keyed><LegalPages type="license" /></Keyed>} />
    <Route path="/cookie-policy/:key?" element={<Keyed><LegalPages type="cookies" /></Keyed>} />

    {/* Fallback */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export function App() {
  const { pathname } = useLocation();
  const base = '/' + (pathname.split('/')[1] ?? '');
  const isGame = base === '/play' || base === '/duel' || base === '/room';

  if (isGame) {
    return (
      <div className="h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors duration-200">
        <GameBar />
        <main id="main-content" className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          {routes}
        </main>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors duration-200">
      <Navbar />
      <main id="main-content" className="flex-1 flex flex-col">
        {routes}
      </main>
      <Footer />
      <ToastContainer />
    </div>
  );
}
export default App;
