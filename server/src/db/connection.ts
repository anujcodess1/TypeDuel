import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import * as fs from 'fs';
import { DB_PATH } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface StatementAdapter {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface DatabaseAdapter {
  exec(sql: string): void;
  prepare(sql: string): StatementAdapter;
  pragma(sql: string): void;
  transaction<T>(fn: () => T): () => T;
  close(): void;
}

class SqliteAdapter implements DatabaseAdapter {
  private db: DatabaseSync;

  constructor(filePath: string) {
    this.db = new DatabaseSync(filePath);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): StatementAdapter {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params: unknown[]) => {
        const res = (stmt.run as any)(...params);
        return {
          changes: Number(res.changes),
          lastInsertRowid: res.lastInsertRowid,
        };
      },
      get: (...params: unknown[]) => (stmt.get as any)(...params) as unknown,
      all: (...params: unknown[]) => (stmt.all as any)(...params) as unknown[],
    };
  }

  pragma(sql: string): void {
    this.db.exec(`PRAGMA ${sql};`);
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.db.exec('BEGIN TRANSACTION;');
      try {
        const res = fn();
        this.db.exec('COMMIT;');
        return res;
      } catch (err) {
        this.db.exec('ROLLBACK;');
        throw err;
      }
    };
  }

  close(): void {
    this.db.close();
  }
}

let _db: DatabaseAdapter | null = null;

export function getDb(): DatabaseAdapter {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new SqliteAdapter(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('cache_size = -64000'); // 64MB
  _db.pragma('temp_store = MEMORY');

  logger.info({ path: DB_PATH }, 'Database connected');
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    logger.info('Database closed');
  }
}
