import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { Play, Swords, Users, ArrowRight } from 'lucide-react';
import { FloatingKeyboardGraphics } from '@/components/FloatingKeyboardGraphics';

interface Stats {
  onlinePlayers: number;
  activeRooms: number;
  racesToday: number;
  duelsToday: number;
  totalRaces: number;
}

interface LbRow {
  username: string;
  net_wpm: number;
  accuracy: number;
}

const MODES = [
  {
    to: '/play',
    no: '01',
    title: 'Solo Practice',
    desc: 'Timed drills with live WPM, accuracy and a speed curve. Pick your difficulty and timer on the page.',
    note: 'Guests welcome — results are still scored and validated.',
    icon: <Play size={18} fill="currentColor" />,
    cta: 'Open Practice',
  },
  {
    to: '/duel',
    no: '02',
    title: 'Ranked 1v1 Duel',
    desc: 'Elo matchmaking drops you against an equal-rated typer in a synchronized race.',
    note: 'Rated — every duel moves your Elo. Login required.',
    icon: <Swords size={18} />,
    cta: 'Open Duel',
  },
  {
    to: '/room',
    no: '03',
    title: 'Team Room',
    desc: 'A shareable 6-letter lobby. Pick 1v1, 2v2 or 4v4 and race friend vs friend.',
    note: 'Two teams, one lobby — the higher team average wins. Login required.',
    icon: <Users size={18} />,
    cta: 'Open Rooms',
  },
];

export function LandingPage() {
  const navigate = useNavigate();

  const [stats, setStats] = useState<Stats | null>(null);
  const [leaders, setLeaders] = useState<LbRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api.stats
        .get()
        .then((s) => { if (alive) setStats(s); })
        .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    api.leaderboard
      .get({ difficulty: 'normal', duration: 60, period: 'weekly' })
      .then((res) => setLeaders((res.rows as unknown[]).slice(0, 8) as LbRow[]))
      .catch(() => setLeaders([]));
  }, []);

  const scrollToModes = () => {
    document.getElementById('modes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const n = (v: number | undefined) => (v === undefined ? '—' : v.toLocaleString());

  return (
    <div className="flex-1">
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-0 md:pt-16 lg:pt-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center pb-12 md:pb-16">
            
            {/* Left Column: Heading, description and start actions */}
            <div className="lg:col-span-6 xl:col-span-6">
              <p className="animate-fade-up font-mono text-xs uppercase tracking-[0.3em] text-accent mb-5">
                TypeDuel — live typing arena
              </p>

              <h1 className="animate-fade-up delay-75 text-5xl sm:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[0.96] mb-6">
                Outtype
                <br />
                <span className="text-gradient">anyone. Live.</span>
              </h1>

              <p className="animate-fade-up delay-150 text-base sm:text-lg text-muted max-w-xl leading-relaxed mb-8">
                Real-time typing races over sockets. Solo drills, ranked 1v1 duels, and 2v2 / 4v4 team lobbies with your own 6-letter code.
              </p>

              <div className="animate-fade-up delay-225 flex flex-wrap items-center gap-4">
                <button
                  onClick={scrollToModes}
                  className="btn-primary flex items-center gap-3 px-8 sm:px-10 py-3.5 sm:py-4 rounded-full text-base sm:text-lg font-bold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  <Play size={20} fill="currentColor" /> Start
                </button>
                <Link
                  to="/leaderboard"
                  className="group flex items-center gap-2 text-base font-semibold text-muted hover:text-[var(--text)] transition-colors"
                >
                  Leaderboard
                  <ArrowRight size={16} className="text-accent group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Right Column: Floating Keyboard SVG & 2-3 Typing SVGs */}
            <div className="lg:col-span-6 xl:col-span-6 animate-fade-up delay-225 flex items-center justify-center">
              <FloatingKeyboardGraphics />
            </div>

          </div>
        </div>

        {/* real stats — hairline strip, no cards */}
        <div className="border-t border-default">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4">
            {[
              { label: 'Typers online', value: stats ? n(stats.onlinePlayers) : '…' },
              { label: 'Rooms live', value: stats ? n(stats.activeRooms) : '…' },
              { label: 'Races today', value: stats ? n(stats.racesToday) : '…' },
              { label: 'Races all-time', value: stats ? n(stats.totalRaces) : '…' },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`py-6 md:py-8 ${i > 0 ? 'md:border-l md:border-default md:pl-6' : ''} ${i >= 2 ? 'border-t border-default md:border-t-0' : ''} ${i === 1 ? 'border-l pl-6 md:pl-6' : ''}`}
              >
                <p className="text-3xl md:text-4xl font-extrabold font-mono tabular-nums tracking-tight">
                  {s.value}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ MODES — each one is its own page ============ */}
      <section id="modes" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 md:py-20 scroll-mt-20">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-3xl font-extrabold tracking-tight">Pick your arena</h2>
          <p className="hidden sm:block text-xs font-mono uppercase tracking-widest text-muted">3 modes</p>
        </div>
        <div className="border-t border-default">
          {MODES.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="group flex items-center gap-5 sm:gap-8 py-6 sm:py-8 border-b border-default text-left no-underline text-[var(--text)] hover:bg-accent/5 transition-colors"
            >
              <span className="font-mono text-sm text-accent shrink-0">{m.no}</span>
              <span className="text-accent shrink-0">{m.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xl sm:text-2xl font-bold leading-tight group-hover:text-accent transition-colors">
                  {m.title}
                </span>
                <span className="block text-sm text-muted mt-1">{m.desc}</span>
                <span className="block text-xs text-muted/80 italic mt-1">{m.note}</span>
              </span>
              <span className="hidden md:flex items-center gap-2 shrink-0 font-bold text-sm text-muted group-hover:text-accent transition-colors">
                {m.cta}
                <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
              </span>
              <ArrowRight size={18} className="md:hidden shrink-0 text-muted group-hover:text-accent transition-colors" />
            </Link>
          ))}
        </div>
      </section>

      {/* ============ WEEKLY TOP ============ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 md:py-20 border-t border-default">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent mb-2">Normal · 60s · this week</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Fastest typers</h2>
          </div>
          <Link
            to="/leaderboard"
            className="group hidden sm:flex items-center gap-2 text-sm font-semibold text-muted hover:text-accent transition-colors"
          >
            Full board <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="border-t border-default font-mono">
          {leaders === null && <p className="py-10 text-muted text-sm">Loading real results…</p>}
          {leaders !== null && leaders.length === 0 && (
            <div className="py-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
              <p className="text-muted text-sm">No 60s races logged this week yet. The board is waiting for you.</p>
              <Link to="/play" className="text-sm font-bold text-accent">
                Set the first time →
              </Link>
            </div>
          )}
          {leaders?.map((r, i) => (
            <div key={`${r.username}-${i}`} className="flex items-baseline gap-5 sm:gap-8 py-3.5 border-b border-default text-sm sm:text-base">
              <span className={`w-8 tabular-nums ${i < 3 ? 'text-accent font-bold' : 'text-muted'}`}>{i + 1}</span>
              <span className="flex-1 font-sans font-semibold truncate">{r.username}</span>
              <span className="tabular-nums text-muted hidden sm:inline">{Math.round(r.accuracy * 10) / 10}%</span>
              <span className="tabular-nums font-bold w-24 text-right">{Math.round(r.net_wpm)} <span className="text-muted font-normal text-xs">wpm</span></span>
            </div>
          ))}
        </div>

        <Link
          to="/leaderboard"
          className="sm:hidden inline-flex items-center gap-2 mt-4 text-sm font-semibold text-accent"
        >
          Full board <ArrowRight size={15} />
        </Link>
      </section>

      {/* ============ CLOSING CTA ============ */}
      <section className="border-t border-default">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 md:py-28 flex flex-col items-center text-center">
          <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
            Sixty seconds.<br /><span className="text-gradient">One winner.</span>
          </h2>
          <p className="text-muted text-lg mb-9 max-w-md">
            {stats
              ? `${stats.onlinePlayers} typer${stats.onlinePlayers === 1 ? '' : 's'} online right now — pull up.`
              : 'Pick a mode, set the clock, and go.'}
          </p>
          <button
            onClick={() => navigate('/duel')}
            className="btn-primary flex items-center gap-3 px-10 py-4 rounded-full text-lg font-bold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <Swords size={20} /> Duel Now
          </button>
        </div>
      </section>
    </div>
  );
}
export default LandingPage;
