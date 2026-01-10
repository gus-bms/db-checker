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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">Process List</div>
        <input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="filter…"
          className="w-72 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
      </div>

      <div className="mt-3 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-slate-200 text-left">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="whitespace-nowrap px-2 py-2 font-semibold text-slate-700"
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
                  className="px-2 py-3 text-slate-500"
                  colSpan={columns.length}
                >
                  loading…
                </td>
              </tr>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  {r.getVisibleCells().map((c) => (
                    <td
                      key={c.id}
                      className="max-w-[520px] px-2 py-2 align-top text-slate-800"
                    >
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-2 py-3 text-slate-500"
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
