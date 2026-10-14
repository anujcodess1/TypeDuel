import { runMigrations } from './migrations.js';
import { getDb, closeDb } from './connection.js';
import { EASY_WORDS, NORMAL_WORDS, HARD_WORDS } from '../services/words.js';
import { hashPassword } from '../services/auth.js';
import { logger } from '../utils/logger.js';

const SAMPLE_USERNAMES = [
  'speedracer', 'keymaster', 'typeking', 'swiftfingers', 'wordwizard',
  'fasttyper', 'qwerty_pro', 'keyboardhero', 'typingace', 'wordrush',
  'blazingkeys', 'typemaster', 'digitalscribe', 'wordsmith', 'keystriker',
  'rapidfire', 'typingpro', 'keyboardking', 'swiftstroke', 'wordblitz',
];

async function seed() {
  logger.info('Starting seed...');
  runMigrations();
  const db = getDb();

  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existingUsers.count > 0) {
    logger.info('Database already seeded. Skipping.');
    closeDb();
    return;
  }

  const insertUser = db.prepare(`
    INSERT INTO users (username, email, password_hash, elo, provisional_games)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertResult = db.prepare(`
    INSERT INTO results (user_id, mode, difficulty, duration, net_wpm, raw_wpm, accuracy,
      consistency, correct_chars, incorrect_chars, text_length, wpm_over_time, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const passwordHash = await hashPassword('SeedPassword123!');

  const seedUsers = db.transaction(async () => {
    const userIds: string[] = [];

    for (const username of SAMPLE_USERNAMES) {
      const elo = Math.floor(900 + Math.random() * 700);
      const result = insertUser.run(username, `${username}@example.com`, passwordHash, elo, 20);
      const user = db.prepare('SELECT id FROM users WHERE rowid = ?').get(result.lastInsertRowid) as { id: string };
      userIds.push(user.id);
    }

    const difficulties = ['easy', 'normal', 'hard'] as const;
    const durations = [15, 30, 60, 120] as const;
    const now = Date.now();

    for (const userId of userIds) {
      for (let i = 0; i < 20; i++) {
        const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)]!;
        const duration = durations[Math.floor(Math.random() * durations.length)]!;
        const baseWpm = difficulty === 'easy' ? 60 : difficulty === 'normal' ? 80 : 95;
        const netWpm = Math.max(20, baseWpm + (Math.random() * 40 - 20));
        const accuracy = 85 + Math.random() * 14;
        const correctChars = Math.round(netWpm * 5 * (duration / 60));
        const daysAgo = Math.floor(Math.random() * 30);
        const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString();
        const wpmOverTime = JSON.stringify(
          Array.from({ length: duration }, (_, i) => ({
            second: i + 1,
            wpm: Math.max(0, netWpm * (i / duration) + (Math.random() * 10 - 5)),
          }))
        );

        insertResult.run(
          userId, 'solo', difficulty, duration,
          Math.round(netWpm * 10) / 10, Math.round((netWpm * 1.1) * 10) / 10,
          Math.round(accuracy * 10) / 10, Math.round((75 + Math.random() * 25) * 10) / 10,
          correctChars, Math.round(correctChars * 0.05),
          correctChars + Math.round(correctChars * 0.05),
          wpmOverTime, createdAt
        );
      }
    }

    logger.info(`Seeded ${userIds.length} users with results`);
    return userIds;
  });

  await seedUsers();
  closeDb();
  logger.info('Seed complete!');
}

seed().catch(err => {
  logger.error(err, 'Seed failed');
  process.exit(1);
});
