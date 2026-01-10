import { useSnapshot, useProcessList } from '../shared/api/hooks';
import KpiCards from '../features/dashboard/components/KpiCards';
import MetricsChart from '../features/dashboard/components/MetricsChart';
import ProcessTable from '../features/dashboard/components/ProcessTable';
import { useEffect } from 'react';

export default function DashboardPage() {
  const snapQ = useSnapshot();
  const procQ = useProcessList();

  const latest = snapQ.data ?? null;
  const ts = snapQ.data?.ts ?? null;

  const processList = procQ.data ?? [];

  const error = snapQ.error || procQ.error;

  useEffect(() => {
    console.log('procQ : ', procQ);
  }, [procQ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-5 py-5">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-bold">DB Checker Viewer</h1>
          <div className="text-xs text-slate-500">
            {ts ? `latest: ${new Date(ts).toLocaleTimeString()}` : 'loading…'}
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {(error as Error)?.message ?? String(error)}
          </div>
        ) : null}

        <div className="mt-4">
          <KpiCards snapshot={latest} isLoading={snapQ.isLoading} />
        </div>

        <div className="mt-4">
          <MetricsChart />
        </div>

        <div className="mt-4">
          <ProcessTable rows={processList} isLoading={procQ.isLoading} />
        </div>
      </div>
    </div>
  );
}
