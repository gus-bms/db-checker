// hooks.ts
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson } from './client';
import { ApiEnvelope, DbSnapshotSchema, ProcessListDataSchema } from './schema';

const pollMs = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? '500');
const retryN = Number(import.meta.env.VITE_QUERY_RETRY ?? '2');
const retry = Number.isFinite(retryN) ? retryN : 2;
const useWs = Boolean(import.meta.env.VITE_WS_URL);

const PATHS = {
  snapshot: '/db/snapshot',
  processList: '/db/process-list',
};

// ✅ 차트는 1초 샘플링
const CHART_SAMPLE_MS = Number(import.meta.env.VITE_CHART_SAMPLE_MS ?? '1000');

// ✅ 화면에 보일 윈도우 크기(예: 60초면 60개)
const CHART_WINDOW_POINTS = Number(
  import.meta.env.VITE_CHART_WINDOW_POINTS ?? '60',
);

export type MetricPoint = {
  seq: number; // serial index (단조 증가)
  t: number; // epoch ms (툴팁 표시용)
  threads_running: number;
  threads_connected: number;
};

export function useSnapshot() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['snapshot'],
    queryFn: ({ signal }) =>
      getJson(PATHS.snapshot, ApiEnvelope(DbSnapshotSchema), signal).then(
        (r) => r.data,
      ),
    refetchInterval: useWs
      ? false
      : (qq) => (qq.state.status === 'error' ? false : pollMs),
    staleTime: useWs ? Infinity : pollMs,
    enabled: !useWs,
    retry,
  });

  const lastSnapTsRef = useRef<string | null>(null);
  const lastSampleTRef = useRef<number | null>(null);

  useEffect(() => {
    const snap = q.data;
    if (!snap) return;

    // 동일 snapshot 중복 방지
    if (lastSnapTsRef.current === snap.ts) return;
    lastSnapTsRef.current = snap.ts;

    const t = Date.parse(snap.ts);

    // ✅ 1초 샘플링
    const lastT = lastSampleTRef.current;
    if (lastT !== null && t - lastT < CHART_SAMPLE_MS) return;
    lastSampleTRef.current = t;

    qc.setQueryData<MetricPoint[]>(['snapshotSeries'], (prev) => {
      const arr = prev ?? [];
      const last = arr[arr.length - 1];

      const nextSeq = (last?.seq ?? 0) + 1;

      const next = arr.concat({
        seq: nextSeq,
        t,
        threads_running: snap.connections.threads_running,
        threads_connected: snap.connections.threads_connected,
      });

      // ✅ 화면 밖 데이터는 버림(고정 길이)
      return next.length > CHART_WINDOW_POINTS
        ? next.slice(-CHART_WINDOW_POINTS)
        : next;
    });
  }, [q.data, qc]);

  return q;
}

export function useSnapshotSeries() {
  return useQuery({
    queryKey: ['snapshotSeries'],
    queryFn: async () => [] as MetricPoint[],
    enabled: false,
    initialData: [] as MetricPoint[],
    staleTime: Infinity,
  });
}

export function useProcessList() {
  return useQuery({
    queryKey: ['processList'],
    queryFn: ({ signal }) =>
      getJson(
        PATHS.processList,
        ApiEnvelope(ProcessListDataSchema),
        signal,
      ).then((r) => r.data.items),
    refetchInterval: useWs
      ? false
      : (qq) => (qq.state.status === 'error' ? false : pollMs),
    staleTime: useWs ? Infinity : pollMs,
    enabled: !useWs,
    retry,
  });
}
