import type { Pool } from 'mysql2/promise';

export type MysqlQueryRunnerOptions = {
  queryTimeoutMs: number;
};

export class MysqlQueryRunner {
  constructor(
    private readonly pool: Pool,
    private readonly opts: MysqlQueryRunnerOptions,
  ) {}

  /**
   * SELECT 계열
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.withTimeout(async () => {
      const [rows] = await this.pool.query(sql, params);
      return rows as T[];
    });
  }

  /**
   * 단일 row가 필요할 때
   */
  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length ? rows[0] : null;
  }

  /**
   * connection-level 작업이 필요할 때 (트랜잭션 등)
   * db-checker는 관측 전용이므로 당장 쓰지 않아도 됩니다.
   */
  async withConnection<T>(fn: (conn: any) => Promise<T>): Promise<T> {
    return this.withTimeout(async () => {
      const conn = await this.pool.getConnection();
      try {
        return await fn(conn);
      } finally {
        conn.release();
      }
    });
  }

  /**
   * 헬스체크: DB가 응답 가능한지 확인
   */
  async ping(): Promise<void> {
    await this.withTimeout(async () => {
      const conn = await this.pool.getConnection();
      try {
        await conn.ping();
      } finally {
        conn.release();
      }
    });
  }

  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    const timeoutMs = this.opts.queryTimeoutMs;

    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`MySQL query timeout after ${timeoutMs}ms`);
        // err.code = 'MYSQL_QUERY_TIMEOUT';
        reject(err);
      }, timeoutMs);
    });

    try {
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
