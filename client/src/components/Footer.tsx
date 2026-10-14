import React from 'react';
import { Link } from 'react-router-dom';
import { Keyboard } from 'lucide-react';

const APP_NAME = 'TypeDuel';

const LINKS: { to: string; label: string }[] = [
  { to: '/play', label: 'Practice' },
  { to: '/duel', label: 'Duel' },
  { to: '/room', label: 'Rooms' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
];

export function Footer() {
  return (
    <footer className="border-t border-default mt-auto" role="contentinfo">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
        <Link to="/" className="flex items-center gap-1.5 font-bold text-[var(--text)] no-underline">
          <Keyboard size={13} className="text-accent" />
          {APP_NAME}
        </Link>
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="text-muted hover:text-accent no-underline transition-colors">
            {l.label}
          </Link>
        ))}
        <span className="ml-auto font-mono">© 2026 {APP_NAME}</span>
      </div>
    </footer>
  );
}
