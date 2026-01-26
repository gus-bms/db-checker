import { type MutableRefObject, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import {
  type DbSnapshot,
  DbSnapshotSchema,
  ProcessListDataSchema,
  SnapshotSeriesSchema,
} from '../api/schema';
import type { MetricPoint } from '../api/hooks';

type SnapshotPayload = { snapshot: unknown };
type ProcesslistPayload = { processlist: unknown };

const WS_URL = import.meta.env.VITE_WS_URL as string | undefined;
const NAMESPACE = '/db';
const CHART_SAMPLE_MS = Number(import.meta.env.VITE_CHART_SAMPLE_MS ?? '1000');
const CHART_WINDOW_POINTS = Number(
  import.meta.env.VITE_CHART_WINDOW_POINTS ?? '60',
);

let socket: Socket | null = null;

function getSocket() {
  if (!socket) {
    const base =
      WS_URL ||
      (typeof window !== 'undefined' ? window.location.origin : undefined);
    if (!base) return null;
    socket = io(`${base}${NAMESPACE}`, {
      transports: ['websocket'],
      withCredentials: true,
    });
  }
  return socket;
}

export function useDbSocketSubscription() {
  const qc = useQueryClient();
  const lastSnapTsRef = useRef<string | null>(null);
  const lastSampleTRef = useRef<number | null>(null);
  const seededSeriesRef = useRef(false);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const onSnapshot = (payload: SnapshotPayload) => {
      const parsed = DbSnapshotSchema.safeParse(payload?.snapshot);
      if (parsed.success) {
        const snap = parsed.data;
        qc.setQueryData(['snapshot'], snap);
        updateSnapshotSeries(qc, snap, lastSnapTsRef, lastSampleTRef);
      }
    };

    const onProcesslist = (payload: ProcesslistPayload) => {
      const parsed = ProcessListDataSchema.safeParse(payload?.processlist);
      if (parsed.success) {
        qc.setQueryData(['processList'], parsed.data.items);
      }
    };

    const onTimeseries = (payload: unknown) => {
      const parsed = SnapshotSeriesSchema.safeParse(payload);
      if (!parsed.success) return;
      if (seededSeriesRef.current) return;

      const series = parsed.data.items.map((snap, idx) => ({
        seq: idx + 1,
        t: Date.parse(snap.ts),
        threads_running: snap.connections.threads_running,
        threads_connected: snap.connections.threads_connected,
      }));

      qc.setQueryData<MetricPoint[]>(['snapshotSeries'], series);
      seededSeriesRef.current = true;
    };

    const subscribe = () =>
      s.emit('subscribe', {
        snapshot: true,
        processlist: true,
        timeseries: true,
      });

    if (s.connected) subscribe();
    s.on('connect', subscribe);
    s.on('db:snapshot', onSnapshot);
    s.on('db:processlist', onProcesslist);
    s.on('db:timeseries', onTimeseries);

    return () => {
      s.off('connect', subscribe);
      s.off('db:snapshot', onSnapshot);
      s.off('db:processlist', onProcesslist);
      s.off('db:timeseries', onTimeseries);
      s.emit('unsubscribe', {
        snapshot: true,
        processlist: true,
        timeseries: true,
      });
    };
  }, [qc]);
}

function updateSnapshotSeries(
  qc: ReturnType<typeof useQueryClient>,
  snap: DbSnapshot,
  lastSnapTsRef: MutableRefObject<string | null>,
  lastSampleTRef: MutableRefObject<number | null>,
) {
  if (lastSnapTsRef.current === snap.ts) return;
  lastSnapTsRef.current = snap.ts;

  const t = Date.parse(snap.ts);
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

    return next.length > CHART_WINDOW_POINTS
      ? next.slice(-CHART_WINDOW_POINTS)
      : next;
  });
}
