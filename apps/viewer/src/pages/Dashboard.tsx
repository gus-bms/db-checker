import {
  useSnapshot,
  useProcessList,
  useThresholds,
} from '../shared/api/hooks';
import { useDbSocketSubscription } from '../shared/ws/useDbSocket';
import KpiCards from '../features/dashboard/components/KpiCards';
import MetricsChart from '../features/dashboard/components/MetricsChart';
import ProcessTable from '../features/dashboard/components/ProcessTable';
import { useEffect, useMemo, useRef, useState } from 'react';

type Level = 'ok' | 'warn' | 'critical';
type Toast = {
  id: number;
  level: Level;
  title: string;
  message: string;
};

function levelFor(value: number, warn: number, critical: number): Level {
  if (value >= critical) return 'critical';
  if (value >= warn) return 'warn';
  return 'ok';
}

function pickTopLevel(levels: Level[]): Level {
  if (levels.includes('critical')) return 'critical';
  if (levels.includes('warn')) return 'warn';
  return 'ok';
}

export default function DashboardPage() {
  useDbSocketSubscription();
  const snapQ = useSnapshot();
  const procQ = useProcessList();
  const thresholdsQ = useThresholds();
  const useWs = Boolean(import.meta.env.VITE_WS_URL);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prevStatusRef = useRef<Level>('ok');
  const toastIdRef = useRef(1);
  const notifiedAtRef = useRef(0);
  const alertDeniedRef = useRef(false);
  const hasRequestedRef = useRef(false);

  const latest = snapQ.data ?? null;
  const ts = snapQ.data?.ts ?? null;

  const processList = procQ.data ?? [];

  const error = snapQ.error || procQ.error;
  const isSnapLoading = snapQ.isLoading || (useWs && !snapQ.data);
  const isProcLoading = procQ.isLoading || (useWs && !procQ.data);

  const thresholds = useMemo(
    () =>
      thresholdsQ.data ?? {
        conn_usage_pct: { warn: 70, critical: 85 },
        threads_running: { warn: 50, critical: 100 },
        row_lock_current_waits: { warn: 3, critical: 10 },
        slow_queries: { warn: 10, critical: 50 },
      },
    [thresholdsQ.data],
  );

  const alerts = useMemo(() => {
    if (!latest) return [];
    return [
      {
        key: 'conn',
        label: 'Connection usage',
        value: `${latest.connections.conn_usage_pct.toFixed(1)}%`,
        level: levelFor(
          latest.connections.conn_usage_pct,
          thresholds.conn_usage_pct.warn,
          thresholds.conn_usage_pct.critical,
        ),
        note: `Max ${latest.connections.max_connections}`,
      },
      {
        key: 'threads',
        label: 'Threads running',
        value: latest.connections.threads_running,
        level: levelFor(
          latest.connections.threads_running,
          thresholds.threads_running.warn,
          thresholds.threads_running.critical,
        ),
        note: `Connected ${latest.connections.threads_connected}`,
      },
      {
        key: 'locks',
        label: 'Row lock waits (current)',
        value: latest.innodb_locks.row_lock_current_waits ?? 0,
        level: levelFor(
          latest.innodb_locks.row_lock_current_waits ?? 0,
          thresholds.row_lock_current_waits.warn,
          thresholds.row_lock_current_waits.critical,
        ),
        note: `Total ${latest.innodb_locks.row_lock_waits}`,
      },
      {
        key: 'slow',
        label: 'Slow queries',
        value: latest.traffic.slow_queries,
        level: levelFor(
          latest.traffic.slow_queries,
          thresholds.slow_queries.warn,
          thresholds.slow_queries.critical,
        ),
        note: 'Cumulative',
      },
    ];
  }, [latest, thresholds]);

  const status = pickTopLevel(alerts.map((a) => a.level));
  const statusLabel =
    status === 'critical' ? 'CRITICAL' : status === 'warn' ? 'WARN' : 'OK';
  const statusTone =
    status === 'critical'
      ? 'bg-rose-100 text-rose-700 border-rose-200'
      : status === 'warn'
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  useEffect(() => {
    if (!latest) return;
    const prev = prevStatusRef.current;
    if (status === 'ok' || status === prev) {
      prevStatusRef.current = status;
      return;
    }

    const now = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const title = status === 'critical' ? 'Critical alert' : 'Warning alert';
    const message = `${now} • ${alerts
      .filter((a) => a.level === status)
      .map((a) => a.label)
      .join(', ')}`;

    const id = toastIdRef.current++;
    setToasts((prevToasts) => [
      { id, level: status, title, message },
      ...prevToasts,
    ]);

    const timer = setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
    }, 6000);

    prevStatusRef.current = status;
    return () => clearTimeout(timer);
  }, [alerts, latest, status]);

  useEffect(() => {
    if (!latest || status === 'ok') return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (alertDeniedRef.current) return;
    if (Date.now() - notifiedAtRef.current < 10_000) return;

    const fire = () => {
      const message = alerts
        .filter((a) => a.level === status)
        .map((a) => a.label)
        .join(', ');
      new Notification(
        status === 'critical' ? 'DB Critical alert' : 'DB Warning alert',
        {
          body: message || 'Check dashboard for details.',
        },
      );
      notifiedAtRef.current = Date.now();
    };

    if (Notification.permission === 'granted') {
      fire();
      return;
    }

    if (Notification.permission === 'denied') {
      alertDeniedRef.current = true;
      return;
    }

    if (!hasRequestedRef.current) {
      hasRequestedRef.current = true;
      void Notification.requestPermission().then((perm) => {
        if (perm === 'granted') fire();
        if (perm === 'denied') alertDeniedRef.current = true;
      });
    }
  }, [alerts, latest, status]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="glass-card fade-in relative rounded-2xl p-6">
          <div className="absolute left-0 top-6 h-14 w-1.5 rounded-r-full bg-slate-900" />
          <div className="flex flex-wrap items-center justify-between gap-6 pl-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Live DB Pulse
              </div>
              <h1 className="mt-3 text-4xl font-semibold text-slate-900">
                DB Checker
              </h1>
              <div className="mt-3 text-sm text-slate-500">
                {ts
                  ? `latest: ${new Date(ts).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })}`
                  : 'loading…'}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                BLUE-GRAY MODE
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone}`}
              >
                {statusLabel}
              </span>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                {useWs ? 'socket' : 'polling'}
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {(error as Error)?.message ?? String(error)}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {alerts.map((alert) => {
            const tone =
              alert.level === 'critical'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : alert.level === 'warn'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900';
            return (
              <div
                key={alert.key}
                className={`fade-in rounded-xl border px-4 py-4 ${tone}`}
              >
                <div className="text-xs uppercase tracking-[0.15em] opacity-70">
                  {alert.label}
                </div>
                <div className="mt-3 text-2xl font-semibold">{alert.value}</div>
                <div className="mt-1 text-xs opacity-70">{alert.note}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 fade-in">
          <KpiCards snapshot={latest} isLoading={isSnapLoading} />
        </div>

        <div className="mt-6 fade-in">
          <MetricsChart />
        </div>

        <div className="mt-6 fade-in">
          <ProcessTable rows={processList} isLoading={isProcLoading} />
        </div>
      </div>

      <div className="fixed right-6 top-6 z-50 flex w-72 flex-col gap-3">
        {toasts.map((toast) => {
          const tone =
            toast.level === 'critical'
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : 'border-amber-200 bg-amber-50 text-amber-900';
          return (
            <div
              key={toast.id}
              className={`fade-in rounded-xl border px-4 py-3 shadow-md ${tone}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs uppercase tracking-[0.2em] opacity-70">
                  {toast.title}
                </div>
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.2em] opacity-60 transition hover:opacity-100"
                  onClick={() =>
                    setToasts((prevToasts) =>
                      prevToasts.filter((t) => t.id !== toast.id),
                    )
                  }
                >
                  Close
                </button>
              </div>
              <div className="mt-2 text-sm">{toast.message}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
