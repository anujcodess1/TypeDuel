import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Shield, Trophy, Cpu, Swords, CheckCircle2 } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3">About TypeDuel</h1>
        <p className="text-muted text-lg max-w-xl mx-auto leading-relaxed">
          A real-time multiplayer typing speed test. Practice solo, duel 1v1 in ranked matches, or create private rooms with friends.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <div className="card p-6 border border-default">
          <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-3">
            <Cpu size={18} />
          </div>
          <h2 className="text-lg font-bold mb-1.5">Fast & Responsive</h2>
          <p className="text-muted text-sm leading-relaxed">
            Minimal latency and smooth caret movement so your typing speed is measured accurately without lag.
          </p>
        </div>

        <div className="card p-6 border border-default">
          <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-3">
            <Shield size={18} />
          </div>
          <h2 className="text-lg font-bold mb-1.5">Anti-Cheat Validation</h2>
          <p className="text-muted text-sm leading-relaxed">
            Keystroke timings and test duration are validated on the server to prevent paste bots and keep the leaderboards fair.
          </p>
        </div>

        <div className="card p-6 border border-default">
          <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-3">
            <Swords size={18} />
          </div>
          <h2 className="text-lg font-bold mb-1.5">Ranked 1v1 Duels</h2>
          <p className="text-muted text-sm leading-relaxed">
            Race live head-to-head against other players. Matchmaking finds opponents around your skill level using an Elo system.
          </p>
        </div>

        <div className="card p-6 border border-default">
          <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-3">
            <Trophy size={18} />
          </div>
          <h2 className="text-lg font-bold mb-1.5">Leaderboards</h2>
          <p className="text-muted text-sm leading-relaxed">
            Track your progress across different word difficulties and durations (15s, 30s, 60s, 120s) on daily and weekly boards.
          </p>
        </div>
      </div>

      <div className="card p-8 border border-default bg-surface text-center">
        <h3 className="text-xl font-bold mb-2">Ready to race?</h3>
        <p className="text-muted text-sm mb-5">Jump into a practice run or queue up for a 1v1 match.</p>
        <div className="flex justify-center gap-3">
          <Link to="/play" className="btn-primary">Start Practice</Link>
          <Link to="/duel" className="btn-secondary">Find a Duel</Link>
        </div>
      </div>
    </div>
  );
}
