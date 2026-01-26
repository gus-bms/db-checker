import type { DbSnapshot } from '../../../shared/api/schema';

type KpiCard = {
  label: string;
  value: string | number;
};
export default function KpiCards({
  snapshot,
  isLoading,
}: {
  snapshot: DbSnapshot | null;
  isLoading: boolean;
}) {
  const skeleton: KpiCard[] = Array.from({ length: 6 }, () => ({
    label: '',
    value: '',
  }));
  const items: KpiCard[] = snapshot
    ? [
        {
          label: 'Threads Connected',
          value: snapshot.connections.threads_connected,
        },
        {
          label: 'Threads Running',
          value: snapshot.connections.threads_running,
        },
        {
          label: `Conn Usage (Max: ${snapshot.connections.max_connections})`,
          value: `${snapshot.connections.conn_usage_pct.toFixed(2)}%`,
        },
        { label: 'Slow Queries', value: snapshot.traffic.slow_queries },
        {
          label: 'Row Lock Waits (cum.)',
          value: snapshot.innodb_locks.row_lock_waits,
        },
        {
          label: 'Row Lock Waits (current)',
          value: snapshot.innodb_locks.row_lock_current_waits ?? '-',
        },
      ]
    : [];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {(isLoading ? skeleton : items).map((it, idx) => (
        <div
          key={idx}
          className="glass-card relative overflow-hidden rounded-xl p-4"
        >
          <div className="text-xs uppercase tracking-[0.15em] text-slate-500">
            {isLoading ? '…' : it.label}
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-900">
            {isLoading ? '—' : it.value}
          </div>
        </div>
      ))}
    </div>
  );
}
