import { getDb } from './connection.js';
import { logger } from '../utils/logger.js';

const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        is_guest INTEGER NOT NULL DEFAULT 0,
        elo INTEGER NOT NULL DEFAULT 1200,
        trust_score REAL NOT NULL DEFAULT 1.0,
        leaderboard_banned_until TEXT,
        provisional_games INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_users_elo ON users(elo DESC);

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        family TEXT NOT NULL,
        is_revoked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        expires_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family);

      CREATE TABLE IF NOT EXISTS results (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        mode TEXT NOT NULL CHECK(mode IN ('solo', 'duel', 'room')),
        difficulty TEXT NOT NULL CHECK(difficulty IN ('easy', 'normal', 'hard')),
        duration INTEGER NOT NULL,
        net_wpm REAL NOT NULL,
        raw_wpm REAL NOT NULL,
        accuracy REAL NOT NULL,
        consistency REAL NOT NULL,
        correct_chars INTEGER NOT NULL,
        incorrect_chars INTEGER NOT NULL,
        text_length INTEGER NOT NULL,
        wpm_over_time TEXT NOT NULL DEFAULT '[]',
        is_flagged INTEGER NOT NULL DEFAULT 0,
        flag_reason TEXT,
        is_personal_best INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_results_user ON results(user_id);
      CREATE INDEX IF NOT EXISTS idx_results_leaderboard ON results(mode, difficulty, duration, net_wpm DESC, created_at DESC) WHERE is_flagged = 0;
      CREATE INDEX IF NOT EXISTS idx_results_daily ON results(created_at, mode, difficulty, duration, net_wpm DESC) WHERE is_flagged = 0;

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        player1_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        player2_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        winner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        player1_wpm REAL,
        player2_wpm REAL,
        player1_accuracy REAL,
        player2_accuracy REAL,
        player1_elo_before INTEGER NOT NULL,
        player2_elo_before INTEGER NOT NULL,
        player1_elo_after INTEGER,
        player2_elo_after INTEGER,
        difficulty TEXT NOT NULL,
        duration INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'finished', 'abandoned')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        finished_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_matches_player1 ON matches(player1_id);
      CREATE INDEX IF NOT EXISTS idx_matches_player2 ON matches(player2_id);
      CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_info TEXT,
        ip TEXT,
        last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

      CREATE TABLE IF NOT EXISTS contact_submissions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        ip TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS login_attempts (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        identifier TEXT NOT NULL,
        ip TEXT NOT NULL,
        success INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier, created_at);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip, created_at);
    `,
  },
];

export function runMigrations(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );
  `);

  const applied = db
    .prepare('SELECT version FROM migrations')
    .all() as { version: number }[];
  const appliedVersions = new Set(applied.map(r => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;

    logger.info({ version: migration.version, name: migration.name }, 'Running migration');

    const runMigration = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name,
      );
    });

    runMigration();
    logger.info({ version: migration.version }, 'Migration applied');
  }
}
