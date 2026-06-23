"use client";
import { useStore } from "@/lib/store";
import { useState, useMemo } from "react";
import { Filter, X, Search } from "lucide-react";
import { fmt } from "@/lib/data-utils";

export default function FiltersPanel() {
  const { columns, columnStats, activeFilters, selectedRecordIds, setFilter, clearFilters, clearSelectedRecordIds, applyFilters, filteredRows, rows } = useStore();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return columns.filter((c) => c.toLowerCase().includes(s) && c !== "pid" && c !== "record_id");
  }, [columns, search]);

  const activeCount = Object.keys(activeFilters).length;

  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Filter size={15} className="text-orange-500" />
            Filtros
            {activeCount > 0 && (
              <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">{activeCount}</span>
            )}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => { applyFilters(); }}
              className="text-xs px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              Aplicar
            </button>
            {activeCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs px-3 py-1 border border-gray-200 text-gray-600 rounded hover:bg-gray-50 flex items-center gap-1"
              >
                <X size={11} /> Limpiar
              </button>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Mostrando <span className="font-medium text-orange-600">{filteredRows.length.toLocaleString("es")}</span> de {rows.length.toLocaleString("es")} participantes
        </div>
        {selectedRecordIds.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-xs bg-red-50 border border-red-100 text-red-700 rounded px-2 py-1">
            <span>Selección global activa: {selectedRecordIds.length.toLocaleString("es")} participantes</span>
            <button onClick={clearSelectedRecordIds} className="underline">Quitar selección</button>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar variable para filtrar…"
            className="w-full text-xs pl-6 py-1.5 border border-gray-200 rounded"
          />
        </div>
      </div>

      <div className="overflow-y-auto max-h-[480px] divide-y divide-gray-50">
        {filtered.slice(0, 40).map((col) => {
          const stats = columnStats[col];
          if (!stats) return null;
          const filter = activeFilters[col];
          const hasFilter = Boolean(filter);

          if (stats.type === "numeric") {
            return (
              <NumericFilter
                key={col}
                col={col}
                stats={stats}
                filter={filter}
                active={hasFilter}
                onChange={(f) => { setFilter(col, f); }}
                onClear={() => setFilter(col, null)}
              />
            );
          } else {
            return (
              <CategoricFilter
                key={col}
                col={col}
                stats={stats}
                filter={filter}
                active={hasFilter}
                onChange={(f) => setFilter(col, f)}
                onClear={() => setFilter(col, null)}
              />
            );
          }
        })}
      </div>
    </div>
  );
}

function NumericFilter({
  col, stats, filter, active, onChange, onClear,
}: {
  col: string;
  stats: import("@/lib/store").ColumnStats;
  filter: import("@/lib/store").ActiveFilter | undefined;
  active: boolean;
  onChange: (f: import("@/lib/store").ActiveFilter) => void;
  onClear: () => void;
}) {
  const mn = stats.min ?? 0;
  const mx = stats.max ?? 100;
  const curMin = filter?.min ?? mn;
  const curMax = filter?.max ?? mx;
  const parseNumberOr = (raw: string, fallback: number) => {
    const value = parseFloat(raw);
    return Number.isFinite(value) ? value : fallback;
  };

  return (
    <div className={`px-3 py-2 ${active ? "bg-orange-50" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700 truncate max-w-[180px]">{col}</span>
        <div className="flex items-center gap-2">
          {active && <button onClick={onClear} className="text-[10px] text-gray-400 hover:text-red-400"><X size={10} /></button>}
          <span className="text-[10px] text-gray-400">{fmt(mn)} – {fmt(mx)}</span>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          value={curMin}
          step="any"
          onChange={(e) => onChange({ ...filter, min: parseNumberOr(e.target.value, mn) })}
          className="w-20 text-xs border border-gray-200 rounded px-1.5 py-1"
        />
        <span className="text-gray-400 text-xs">–</span>
        <input
          type="number"
          value={curMax}
          step="any"
          onChange={(e) => onChange({ ...filter, max: parseNumberOr(e.target.value, mx) })}
          className="w-20 text-xs border border-gray-200 rounded px-1.5 py-1"
        />
      </div>
    </div>
  );
}

function CategoricFilter({
  col, stats, filter, active, onChange, onClear,
}: {
  col: string;
  stats: import("@/lib/store").ColumnStats;
  filter: import("@/lib/store").ActiveFilter | undefined;
  active: boolean;
  onChange: (f: import("@/lib/store").ActiveFilter) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const vals = (stats.topValues ?? []).slice(0, 15);
  const selected = filter?.values ?? [];

  const toggle = (v: string) => {
    const s = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    if (s.length === 0) onClear();
    else onChange({ values: s });
  };

  return (
    <div className={`px-3 py-2 ${active ? "bg-orange-50" : ""}`}>
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-xs font-medium text-gray-700 truncate max-w-[180px]">{col}</span>
        <div className="flex items-center gap-2">
          {active && (
            <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="text-[10px] text-gray-400 hover:text-red-400"><X size={10} /></button>
          )}
          {active && <span className="text-[10px] bg-orange-100 text-orange-700 px-1 rounded">{selected.length} sel.</span>}
          <span className="text-gray-400 text-[10px]">{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto">
          {vals.map(({ value, count }) => (
            <label key={value} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => toggle(value)}
                className="accent-orange-500"
              />
              <span className="flex-1 truncate text-gray-600">{value || "–"}</span>
              <span className="text-gray-400 shrink-0">{count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
