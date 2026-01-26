import { useMemo, useState } from 'react';
import type { ProcessItem } from '../../../shared/api/schema';
import type { ColumnDef } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

export default function ProcessTable({
  rows,
  isLoading,
}: {
  rows: ProcessItem[];
  isLoading: boolean;
}) {
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<ProcessItem>[]>(
    () => [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'user', header: 'User' },
      { accessorKey: 'host', header: 'Host' },
      { accessorKey: 'db', header: 'DB' },
      { accessorKey: 'command', header: 'Command' },
      { accessorKey: 'time', header: 'Time' },
      { accessorKey: 'state', header: 'State' },
      {
        accessorKey: 'info',
        header: 'Info',
        cell: (ctx) => {
          const v = (ctx.getValue() as string | null) ?? '';
          return v.length > 120 ? `${v.slice(0, 120)}…` : v || '-';
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Process List
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
            live threads
          </div>
        </div>
        <input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="filter…"
          className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-slate-400 md:w-72"
        />
      </div>

      <div className="mt-4 overflow-auto rounded-lg border border-slate-100 bg-white/70">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-slate-200 text-left">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className={`sticky top-0 z-10 whitespace-nowrap bg-white/90 px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 backdrop-blur ${
                      h.column.id === 'id'
                        ? 'w-16'
                        : h.column.id === 'user'
                          ? 'w-28'
                          : h.column.id === 'host'
                            ? 'w-44'
                            : h.column.id === 'db'
                              ? 'w-24'
                              : h.column.id === 'command'
                                ? 'w-24'
                                : h.column.id === 'time'
                                  ? 'w-20'
                                  : h.column.id === 'state'
                                    ? 'w-40'
                                : 'w-[360px]'
                    }`}
                    onClick={h.column.getToggleSortingHandler()}
                    style={{
                      cursor: h.column.getCanSort() ? 'pointer' : 'default',
                    }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === 'asc'
                      ? ' ▲'
                      : h.column.getIsSorted() === 'desc'
                      ? ' ▼'
                      : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="px-3 py-4 text-slate-500"
                  colSpan={columns.length}
                >
                  loading…
                </td>
              </tr>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 transition hover:bg-slate-50/80"
                >
                  {r.getVisibleCells().map((c) => (
                    <td
                      key={c.id}
                      className={`px-3 py-2 align-top text-slate-800 ${
                        c.column.id === 'info'
                          ? 'max-w-[360px] whitespace-normal break-words'
                          : 'whitespace-nowrap'
                      }`}
                    >
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-3 py-4 text-slate-500"
                  colSpan={columns.length}
                >
                  no rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
