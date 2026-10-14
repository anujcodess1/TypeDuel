import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import * as crypto from 'crypto';

import { env, CORS_ORIGINS, APP_NAME } from './config/index.js';
import { logger } from './utils/logger.js';
import { runMigrations } from './db/migrations.js';
import { closeDb } from './db/connection.js';
import { globalLimit } from './middleware/rateLimiter.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { setupSocketHandlers } from './sockets/index.js';

import authRoutes from './routes/auth.js';
import leaderboardRoutes from './routes/leaderboard.js';
import contactRoutes from './routes/contact.js';
import statsRoutes from './routes/stats.js';

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.locals['requestId'] = crypto.randomUUID();
  res.setHeader('X-Request-ID', res.locals['requestId'] as string);
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", ...CORS_ORIGINS],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false,
}));
app.disable('x-powered-by');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || CORS_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: Origin not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-ID'],
}));

app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());

app.use(globalLimit);

app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url, ip: req.ip }, 'Request');
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: APP_NAME, uptime: process.uptime() });
});

app.get('/ready', async (_req, res) => {
  try {
    const { getDb } = await import('./db/connection.js');
    getDb();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/stats', statsRoutes);

app.use(notFound);
app.use(errorHandler);

const io = new SocketServer(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'],
  allowEIO3: false,
  pingTimeout: 30000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e5,
});

app.set('io', io);
setupSocketHandlers(io);

runMigrations();

const server = httpServer.listen(env.PORT, env.HOST, () => {
  logger.info(`${APP_NAME} server running on http://${env.HOST}:${env.PORT} [${env.NODE_ENV}]`);
});

async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Shutting down gracefully');

  io.close(() => logger.info('Socket.IO closed'));

  server.close(() => {
    logger.info('HTTP server closed');
    closeDb();
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, io };
