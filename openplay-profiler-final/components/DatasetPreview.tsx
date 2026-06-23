"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Table, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

export default function DatasetPreview() {
  const { rows, columns, totalRows } = useStore();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  if (!rows.length) return null;

  const displayCols = columns.slice(0, 20); // máx 20 columnas en preview
  const filtered = search
    ? rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(search.toLowerCase())))
    : rows;

  const total = filtered.length;
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Table size={15} className="text-orange-500" />
          Vista previa del dataset
          <span className="text-gray-400 font-normal">({totalRows.toLocaleString("es")} participantes · {columns.length} variables)</span>
        </h2>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Buscar…"
          className="text-xs border border-gray-200 rounded px-2 py-1 w-40"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              {displayCols.map((col) => (
                <th key={col} className="text-left px-2 py-1.5 border-b border-gray-200 font-medium text-gray-600 whitespace-nowrap max-w-32 overflow-hidden text-ellipsis" title={col}>
                  {col}
                </th>
              ))}
              {columns.length > 20 && <th className="text-gray-400 px-2 py-1.5 border-b border-gray-200">+{columns.length - 20} más</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="hover:bg-orange-50 border-b border-gray-100">
                {displayCols.map((col) => (
                  <td key={col} className="px-2 py-1.5 text-gray-600 max-w-32 overflow-hidden text-ellipsis whitespace-nowrap" title={String(row[col] ?? "")}>
                    {row[col] === null || row[col] === undefined || row[col] === ""
                      ? <span className="text-gray-300">–</span>
                      : String(row[col])}
                  </td>
                ))}
                {columns.length > 20 && <td className="px-2 py-1.5 text-gray-300">…</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
        <span>Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total.toLocaleString("es")}</span>
        <div className="flex gap-1">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="p-1 disabled:opacity-30 hover:text-orange-500">
            <ChevronLeft size={14} />
          </button>
          <span className="px-2">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="p-1 disabled:opacity-30 hover:text-orange-500">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
