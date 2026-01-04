import { Inject, Injectable } from '@nestjs/common';
import { MYSQL_RUNNER } from '../connectors/mysql/mysql.tokens';
import { MysqlQueryRunner } from '../connectors/mysql/mysql.query-runner';

type StatusRow = { Variable_name: string; Value: string };
type VarRow = { Variable_name: string; Value: string };

@Injectable()
export class DbResourcesService {
  constructor(@Inject(MYSQL_RUNNER) private readonly mysql: MysqlQueryRunner) {}

  async getResources() {
    // 1) 필요한 STATUS 목록
    const statusRows = await this.mysql.query<StatusRow>(`
      SHOW GLOBAL STATUS
      WHERE Variable_name IN (
        'Threads_connected','Threads_running',
        'Connections','Aborted_connects','Aborted_clients',
        'Questions','Queries',
        'Com_commit','Com_rollback',
        'Slow_queries',

        'Innodb_row_lock_current_waits',
        'Innodb_row_lock_time',
        'Innodb_row_lock_time_max',
        'Innodb_row_lock_waits',
        'Innodb_row_lock_timeouts',

        'Innodb_buffer_pool_reads',
        'Innodb_buffer_pool_read_requests'
      );
    `);

    // 2) 필요한 VARIABLES 목록
    const varRows = await this.mysql.query<VarRow>(`
      SHOW GLOBAL VARIABLES
      WHERE Variable_name IN (
        'max_connections',
        'slow_query_log',
        'long_query_time'
      );
    `);

    const s = new Map<string, string>();
    const v = new Map<string, string>();
    for (const r of statusRows) s.set(r.Variable_name, r.Value);
    for (const r of varRows) v.set(r.Variable_name, r.Value);

    const numS = (k: string) => Number(s.get(k) ?? 0);
    const numV = (k: string) => Number(v.get(k) ?? 0);
    const strV = (k: string) => String(v.get(k) ?? '');

    const threadsConnected = numS('Threads_connected');
    const threadsRunning = numS('Threads_running');
    const maxConnections = numV('max_connections') || 0;

    const connUsagePct =
      maxConnections > 0
        ? Number(((threadsConnected / maxConnections) * 100).toFixed(2))
        : null;

    // buffer pool hit ratio (가능할 때만)
    const bpReads = numS('Innodb_buffer_pool_reads');
    const bpReadReq = numS('Innodb_buffer_pool_read_requests');
    const bufferPoolHitPct =
      bpReadReq > 0
        ? Number(((1 - bpReads / bpReadReq) * 100).toFixed(2))
        : null;

    return {
      ts: new Date().toISOString(),

      connections: {
        threads_connected: threadsConnected,
        threads_running: threadsRunning,
        max_connections: maxConnections || null,
        conn_usage_pct: connUsagePct,

        connections_total: numS('Connections'),
        aborted_connects: numS('Aborted_connects'),
        aborted_clients: numS('Aborted_clients'),
      },

      traffic: {
        questions: numS('Questions'),
        queries: numS('Queries'),
        com_commit: numS('Com_commit'),
        com_rollback: numS('Com_rollback'),
        slow_queries: numS('Slow_queries'),
      },

      innodb_locks: {
        row_lock_current_waits: numS('Innodb_row_lock_current_waits') || null,
        row_lock_waits: numS('Innodb_row_lock_waits') || null,
        row_lock_time_ms_total: numS('Innodb_row_lock_time') || null,
        row_lock_time_ms_max: numS('Innodb_row_lock_time_max') || null,
        row_lock_timeouts: numS('Innodb_row_lock_timeouts') || null,
      },

      innodb_buffer: {
        buffer_pool_hit_pct: bufferPoolHitPct,
        buffer_pool_reads: bpReads || null,
        buffer_pool_read_requests: bpReadReq || null,
      },

      slow_query_config: {
        slow_query_log: strV('slow_query_log'),
        long_query_time: Number(strV('long_query_time') || 0),
      },
    };
  }
}
