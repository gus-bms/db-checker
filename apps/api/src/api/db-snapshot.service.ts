import { Inject, Injectable } from '@nestjs/common';
import { MYSQL_RUNNER } from '../connectors/mysql/mysql.tokens';
import { MysqlQueryRunner } from '../connectors/mysql/mysql.query-runner';

type StatusRow = { Variable_name: string; Value: string };
type VarRow = { Variable_name: string; Value: string };

@Injectable()
export class DbSnapshotService {
  constructor(@Inject(MYSQL_RUNNER) private readonly mysql: MysqlQueryRunner) {}

  async getSnapshot() {
    const statusRows = await this.mysql.query<StatusRow>(`
      SHOW GLOBAL STATUS
      WHERE Variable_name IN (
        'Threads_connected',
        'Threads_running',
        'Connections',
        'Aborted_connects',
        'Aborted_clients',
        'Questions',
        'Queries',
        'Com_commit',
        'Com_rollback',
        'Slow_queries',
        'Innodb_row_lock_waits',
        'Innodb_row_lock_time'
      )
    `);

    const varRows = await this.mysql.query<VarRow>(`
      SHOW GLOBAL VARIABLES
      WHERE Variable_name IN (
        'max_connections'
      )
    `);

    const status = toMap(statusRows);
    const vars = toMap(varRows);

    const num = (m: Record<string, string>, k: string) => {
      const v = m[k];
      if (v == null) return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const ts = new Date().toISOString();

    const threads_connected = num(status, 'Threads_connected');
    const threads_running = num(status, 'Threads_running');
    const max_connections = num(vars, 'max_connections');

    const conn_usage_pct =
      max_connections > 0
        ? Number(((threads_connected / max_connections) * 100).toFixed(2))
        : 0;

    // InnoDB lock metrics (MySQL 5.7 기준)
    const row_lock_waits = num(status, 'Innodb_row_lock_waits');
    const row_lock_time_ms = num(status, 'Innodb_row_lock_time');

    // "현재 대기중인 row lock wait 수"는 환경/권한/테이블 존재 여부에 따라 실패 가능 -> nullable로 안전 처리
    const row_lock_current_waits = await this.getRowLockCurrentWaitsOrNull();

    return {
      ts,
      connections: {
        threads_connected,
        threads_running,
        max_connections,
        conn_usage_pct,
        connections_total: num(status, 'Connections'),
        aborted_connects: num(status, 'Aborted_connects'),
        aborted_clients: num(status, 'Aborted_clients'),
      },
      traffic: {
        questions: num(status, 'Questions'),
        queries: num(status, 'Queries'),
        com_commit: num(status, 'Com_commit'),
        com_rollback: num(status, 'Com_rollback'),
        slow_queries: num(status, 'Slow_queries'),
      },
      innodb_locks: {
        row_lock_current_waits, // number | null
        row_lock_waits, // number
        row_lock_time_ms, // number (필수)
      },
    };
  }

  private async getRowLockCurrentWaitsOrNull(): Promise<number | null> {
    try {
      // MySQL 5.7에서 존재하는 경우가 많지만, 권한/설정에 따라 실패할 수 있음
      const row = await this.mysql.queryOne<{ cnt: any }>(`
        SELECT COUNT(*) AS cnt
        FROM information_schema.innodb_lock_waits
      `);

      const cnt = Number(row?.cnt);
      return Number.isFinite(cnt) ? cnt : null;
    } catch {
      return null;
    }
  }
}

function toMap(rows: Array<{ Variable_name: string; Value: string }>) {
  const m: Record<string, string> = {};
  for (const r of rows) m[r.Variable_name] = r.Value;
  return m;
}
