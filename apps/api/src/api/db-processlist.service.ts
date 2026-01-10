import { Inject, Injectable } from '@nestjs/common';
import { MYSQL_RUNNER } from '../connectors/mysql/mysql.tokens';
import { MysqlQueryRunner } from '../connectors/mysql/mysql.query-runner';

type ProcessRow = {
  ID: number;
  USER: string;
  HOST: string;
  DB: string | null;
  COMMAND: string;
  TIME: number;
  STATE: string | null;
  INFO: string | null;
};

export type ProcesslistItem = {
  id: number;
  user: string;
  host: string;
  db: string | null;
  command: string;
  time: number;
  state: string | null;
  sql_text: string | null;
  sql_truncated: boolean;
};

@Injectable()
export class DbProcesslistService {
  constructor(@Inject(MYSQL_RUNNER) private readonly mysql: MysqlQueryRunner) {}

  async getProcesslist(opts: {
    limit?: number;
    includeSleep?: boolean;
    minTimeSec?: number;
    maxSqlLen?: number;
  }) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const includeSleep = opts.includeSleep ?? false;
    const minTimeSec = Math.max(opts.minTimeSec ?? 0, 0);
    const maxSqlLen = Math.max(opts.maxSqlLen ?? 2000, 100);

    const where: string[] = [];
    if (!includeSleep) where.push(`COMMAND <> 'Sleep'`);
    if (minTimeSec > 0) where.push(`TIME >= ${minTimeSec}`);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await this.mysql.query<
      ProcessRow & { INFO_LEN: number | null }
    >(
      `
      SELECT
        ID, USER, HOST, DB, COMMAND, TIME, STATE,
        INFO,
        CHAR_LENGTH(INFO) AS INFO_LEN
      FROM information_schema.PROCESSLIST
      ${whereSql}
      ORDER BY TIME DESC
      LIMIT ?;
      `,
      [limit],
    );

    const items: ProcesslistItem[] = rows.map((r) => {
      const raw = r.INFO ?? null;
      const rawLen = r.INFO_LEN ?? (raw ? raw.length : 0);
      const truncated = rawLen > maxSqlLen;

      return {
        id: r.ID,
        user: r.USER,
        host: r.HOST,
        db: r.DB,
        command: r.COMMAND,
        time: Number(r.TIME ?? 0),
        state: r.STATE,
        sql_text: raw ? (truncated ? raw.slice(0, maxSqlLen) : raw) : null,
        sql_truncated: truncated,
      };
    });

    return {
      ts: new Date().toISOString(),
      total: items.length,
      items,
    };
  }
}
