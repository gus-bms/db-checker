import { z } from 'zod';

export const DbSnapshotSchema = z.object({
  ts: z.string(),
  connections: z.object({
    threads_connected: z.number(),
    threads_running: z.number(),
    max_connections: z.number(),
    conn_usage_pct: z.number(),
    connections_total: z.number(),
    aborted_connects: z.number(),
    aborted_clients: z.number(),
  }),
  traffic: z.object({
    questions: z.number(),
    queries: z.number(),
    com_commit: z.number(),
    com_rollback: z.number(),
    slow_queries: z.number(),
  }),
  innodb_locks: z.object({
    row_lock_current_waits: z.number().nullable(),
    row_lock_waits: z.number(),
    row_lock_time_ms: z.number(),
  }),
});

export const ProcesslistItemSchema = z.object({
  id: z.number(),
  user: z.string(),
  host: z.string(),
  db: z.string().nullable(),
  command: z.string(),
  time: z.number(),
  state: z.string().nullable(),
  sql_text: z.string().nullable(),
  sql_truncated: z.boolean(),
});

export const ProcessListDataSchema = z.object({
  ts: z.string(), // ISO string
  total: z.number(),
  items: ProcesslistItemSchema.array(),
});

export const SnapshotSeriesSchema = z.object({
  from: z.number(),
  to: z.number(),
  count: z.number(),
  items: DbSnapshotSchema.array(),
});

export const ApiEnvelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    requestId: z.string().nullable(),
    success: z.boolean(),
    code: z.string(),
    message: z.string().nullable(),
    data,
    error: z.unknown().nullable().optional(),
  });

export type DbSnapshot = z.infer<typeof DbSnapshotSchema>;
export type ProcessItem = z.infer<typeof ProcesslistItemSchema>;
