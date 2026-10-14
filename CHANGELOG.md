# Changelog

All notable changes to TypeDuel are documented here.

## [1.0.0] — 2026-10-13

### Added
- Solo typing test with Easy / Normal / Hard difficulty and 15s / 30s / 60s / 120s timers
- Live WPM, accuracy, and error tracking with per-character highlighting
- WPM-over-time result chart
- Private rooms with up to 8 players, password protection, host controls, and reconnect support
- Online 1v1 Elo-based matchmaking with widening search window
- Leaderboard with Daily / Weekly / All-time tabs and cursor pagination
- User authentication: register, login, refresh token rotation, logout-all-devices, delete account
- Guest mode for unauthenticated solo play
- Full profile page: best WPM, accuracy, match history, Elo graph, active sessions
- Landing page, FAQ, Terms of Service, Privacy Policy, About, Contact, License, 404, 500 pages
- Real-time anti-cheat: server-authoritative scoring, keystroke validation, bot detection
- Helmet security headers, CORS origin whitelist, CSRF protection
- Rate limiting on all routes with stricter tiers for auth and join/create room
- SQLite WAL mode with repository layer
- Vite + React 18 + TypeScript frontend with Tailwind CSS
- Zustand state management with selector-based subscriptions
- Socket.IO with WebSocket-only transport and binary payloads
- Service worker for static asset caching
- Full keyboard navigation, ARIA live regions, WCAG AA contrast
- Docker and docker-compose for one-command deployment
- GitHub Actions CI: lint, typecheck, test, audit, build, bundle size check
