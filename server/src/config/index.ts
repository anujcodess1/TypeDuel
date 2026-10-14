import { z } from 'zod';
import * as path from 'path';
import { fileURLToPath } from 'url';

import * as fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env if present
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
];
for (const p of possibleEnvPaths) {
  if (fs.existsSync(p)) {
    try {
      if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(p);
      }
    } catch {}
    break;
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_PATH: z.string().default('../data/typeduel.db'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z.string().transform(v => v === 'true').default('false'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(200),
  CAPTCHA_ENABLED: z.string().transform(v => v === 'true').default('false'),
  CAPTCHA_SECRET: z.string().optional(),
  CONTACT_EMAIL: z.string().email().default('hello@typeduel.io'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_URL: z.string().url().default('http://localhost:3001'),
});

type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const APP_NAME = 'TypeDuel';
export const APP_VERSION = '1.0.0';

export const DB_PATH = path.resolve(__dirname, '..', env.DATABASE_PATH);

export const CORS_ORIGINS = env.CORS_ORIGINS.split(',').map(o => o.trim());

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'strict' as const,
};
