import pino from 'pino';
import { env } from '../config/index.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } } }
    : {}),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.refreshToken'],
    censor: '[REDACTED]',
  },
});

export function auditLog(
  event: string,
  data: Record<string, unknown>,
) {
  logger.info({ audit: true, event, ...data });
}
