import Database, { type Database as SqliteDatabase } from 'better-sqlite3';

class MockSQLiteDatabase {
  private readonly db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(
    sql: string,
    params: unknown[] = []
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...(params as never[]));
    return {
      lastInsertRowId: Number(result.lastInsertRowid),
      changes: result.changes,
    };
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...(params as never[]));
    return (row ?? null) as T | null;
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...(params as never[])) as T[];
  }

  async withExclusiveTransactionAsync<R>(
    fn: (tx: MockSQLiteDatabase) => Promise<R>
  ): Promise<R> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // ignore rollback failures
      }
      throw error;
    }
  }
}

const databases = new Map<string, MockSQLiteDatabase>();

export type SQLiteDatabase = MockSQLiteDatabase;

export async function openDatabaseAsync(name: string): Promise<MockSQLiteDatabase> {
  const existing = databases.get(name);
  if (existing) {
    return existing;
  }

  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const wrapped = new MockSQLiteDatabase(db);
  databases.set(name, wrapped);
  return wrapped;
}

export function __resetMockDatabases(): void {
  databases.clear();
}
