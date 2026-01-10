import { useEffect, useMemo, useRef, useState } from 'react';
import { useSnapshotSeries } from '../../../shared/api/hooks';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const TOOLTIP_W = 220;
const TOOLTIP_H = 76; // 대략(너무 작으면 아래 clamp가 덜 먹음)
const PAD = 8;

function fmtTime(t: number) {
  return new Date(t).toLocaleTimeString();
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max));
}

export default function MetricsChart() {
  const seriesQ = useSnapshotSeries();
  const series = seriesQ.data ?? [];

  // ✅ chart container size를 state로 유지 (render 중 ref 접근 불가 환경 대응)
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapSize, setWrapSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      // observer callback에서 setState는 "외부 시스템 구독"이라 규칙 위반 아님
      setWrapSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { data, domain } = useMemo(() => {
    if (!series.length) return { data: [], domain: [0, 0] as [number, number] };

    const minSeq = series[0].seq;
    const maxSeq = series[series.length - 1].seq;

    const d = series.map((p) => ({
      x: p.seq,
      t: p.t,
      threads_running: p.threads_running,
      threads_connected: p.threads_connected,
    }));

    return { data: d, domain: [minSeq, maxSeq] as [number, number] };
  }, [series]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">Connections</div>

      {/* ✅ overflow-hidden으로 "툴팁이 밖으로 튀며 흔들리는" 문제 방지 */}
      <div ref={wrapRef} className="mt-3 h-56 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 24, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="x"
              type="number"
              domain={domain}
              allowDataOverflow
              tick={false}
              axisLine={false}
              tickLine={false}
            />
            <YAxis />

            <Tooltip
              isAnimationActive={false}
              wrapperStyle={{ pointerEvents: 'none' }}
              content={({ active, payload, coordinate }) => {
                if (!active || !payload?.length || !coordinate) return null;

                const t = Number(payload[0]?.payload?.t ?? 0);
                const running = Number(
                  payload.find((p) => p.dataKey === 'threads_running')?.value ??
                    0,
                );
                const connected = Number(
                  payload.find((p) => p.dataKey === 'threads_connected')
                    ?.value ?? 0,
                );

                // ✅ viewBox 대신 wrapSize로 좌/우/상/하 클램프
                const maxLeft = Math.max(PAD, wrapSize.w - TOOLTIP_W - PAD);
                const maxTop = Math.max(PAD, wrapSize.h - TOOLTIP_H - PAD);

                const left = clamp(coordinate.x, PAD, maxLeft);
                const top = clamp(coordinate.y - 56, PAD, maxTop);

                return (
                  <div
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow"
                    style={{
                      position: 'absolute',
                      left,
                      top,
                      width: TOOLTIP_W,
                    }}
                  >
                    <div className="font-semibold text-slate-900">
                      {fmtTime(t)}
                    </div>
                    <div className="mt-1 flex justify-between gap-6">
                      <span>threads_running</span>
                      <span className="font-medium">{running}</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-6">
                      <span>threads_connected</span>
                      <span className="font-medium">{connected}</span>
                    </div>
                  </div>
                );
              }}
            />

            <Line
              type="monotone"
              dataKey="threads_running"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="threads_connected"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
