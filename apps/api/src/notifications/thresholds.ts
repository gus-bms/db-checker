export type Thresholds = {
  conn_usage_pct: { warn: number; critical: number };
  threads_running: { warn: number; critical: number };
  row_lock_current_waits: { warn: number; critical: number };
  slow_queries: { warn: number; critical: number };
};

export function getThresholdsFromEnv(): Thresholds {
  return {
    conn_usage_pct: {
      warn: numEnv('ALERT_CONN_USAGE_WARN', 70),
      critical: numEnv('ALERT_CONN_USAGE_CRITICAL', 85),
    },
    threads_running: {
      warn: numEnv('ALERT_THREADS_RUNNING_WARN', 50),
      critical: numEnv('ALERT_THREADS_RUNNING_CRITICAL', 100),
    },
    row_lock_current_waits: {
      warn: numEnv('ALERT_LOCK_WAITS_WARN', 3),
      critical: numEnv('ALERT_LOCK_WAITS_CRITICAL', 10),
    },
    slow_queries: {
      warn: numEnv('ALERT_SLOW_QUERIES_WARN', 10),
      critical: numEnv('ALERT_SLOW_QUERIES_CRITICAL', 50),
    },
  };
}

function numEnv(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
