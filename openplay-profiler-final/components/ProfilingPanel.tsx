"use client";
import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { fmt, fmtInt } from "@/lib/data-utils";
import { BarChart2, Search, ChevronDown, ChevronRight } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const ORANGE = "#f97316";
const GRAY = "#9ca3af";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs py-0.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono text-gray-700">{value}</span>
    </div>
  );
}

export default function ProfilingPanel() {
  const { columnStats, columns, filteredRows } = useStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"histogram" | "box" | "violin" | "bar">("histogram");

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return columns.filter((c) => c.toLowerCase().includes(s));
  }, [columns, search]);

  const stats = selected ? columnStats[selected] : null;

  const chartData = useMemo(() => {
    if (!selected || !stats) return null;
    const vals = filteredRows
      .map((r) => r[selected])
      .filter((v) => v !== null && v !== undefined && v !== "");

    if (stats.type === "numeric") {
      const nums = vals.map(Number).filter((n) => isFinite(n));
      if (chartType === "histogram") {
        return [{ type: "histogram" as const, x: nums, marker: { color: ORANGE }, nbinsx: 30, name: selected }];
      } else if (chartType === "box") {
        return [{ type: "box" as const, y: nums, marker: { color: ORANGE }, name: selected, boxpoints: "outliers" as const }];
      } else {
        return [{ type: "violin" as const, y: nums, marker: { color: ORANGE }, name: selected, box: { visible: true } }];
      }
    } else {
      const freq: Record<string, number> = {};
      for (const v of vals) {
        const k = String(v);
        freq[k] = (freq[k] ?? 0) + 1;
      }
      const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20);
      return [{ type: "bar" as const, x: sorted.map(([k]) => k), y: sorted.map(([, v]) => v), marker: { color: ORANGE }, name: selected }];
    }
  }, [selected, stats, filteredRows, chartType]);

  const missingPct = stats ? ((stats.missing / (stats.count + stats.missing)) * 100).toFixed(1) : "0";

  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <BarChart2 size={15} className="text-orange-500" /> Profiling de variables
        </h2>
      </div>

      <div className="flex h-[600px]">
        {/* Lista de columnas */}
        <div className="w-56 border-r border-gray-100 flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar variable…"
                className="w-full text-xs pl-6 pr-2 py-1.5 border border-gray-200 rounded"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map((col) => {
              const s = columnStats[col];
              const missingPct2 = s ? (s.missingPct).toFixed(0) : "?";
              return (
                <button
                  key={col}
                  onClick={() => {
                    setSelected(col);
                    setChartType(s?.type === "numeric" ? "histogram" : "bar");
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs border-b border-gray-50 hover:bg-orange-50 ${selected === col ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-700"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{col}</span>
                    <span className={`text-[10px] ml-1 shrink-0 ${s?.type === "numeric" ? "text-blue-400" : "text-green-400"}`}>
                      {s?.type === "numeric" ? "N" : "C"}
                    </span>
                  </div>
                  {parseFloat(missingPct2) > 5 && (
                    <div className="text-[10px] text-gray-400">{missingPct2}% faltantes</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel de stats */}
        <div className="flex-1 p-4 overflow-y-auto">
          {!selected && (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Selecciona una variable de la lista
            </div>
          )}

          {selected && stats && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-800 text-sm">{selected}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${stats.type === "numeric" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                  {stats.type === "numeric" ? "Numérico" : "Categórico"}
                </span>
              </div>

              {/* Selector de gráfico */}
              {stats.type === "numeric" && (
                <div className="flex gap-1">
                  {(["histogram", "box", "violin"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setChartType(t)}
                      className={`text-xs px-2 py-1 rounded border ${chartType === t ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-600 hover:border-orange-300"}`}
                    >
                      {t === "histogram" ? "Histograma" : t === "box" ? "Boxplot" : "Violin"}
                    </button>
                  ))}
                </div>
              )}

              {/* Gráfico */}
              {chartData && (
                <div className="border border-gray-100 rounded overflow-hidden">
                  <Plot
                    data={chartData}
                    layout={{
                      height: 220, margin: { t: 10, r: 10, b: 40, l: 40 },
                      paper_bgcolor: "white", plot_bgcolor: "#fafafa",
                      font: { size: 11 }, showlegend: false,
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: "100%" }}
                  />
                </div>
              )}

              {/* Estadísticas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Resumen</div>
                  <StatRow label="Válidos" value={fmtInt(stats.count)} />
                  <StatRow label="Faltantes" value={`${fmtInt(stats.missing)} (${missingPct}%)`} />
                  <StatRow label="Únicos" value={fmtInt(stats.unique)} />
                  <StatRow label="Moda" value={String(stats.mode ?? "–")} />
                  <StatRow label="Entropía" value={fmt(stats.entropy)} />
                </div>

                {stats.type === "numeric" && (
                  <div className="bg-gray-50 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-2">Distribución</div>
                    <StatRow label="Media" value={fmt(stats.mean)} />
                    <StatRow label="Mediana" value={fmt(stats.median)} />
                    <StatRow label="Desv. est." value={fmt(stats.std)} />
                    <StatRow label="Mín" value={fmt(stats.min)} />
                    <StatRow label="Máx" value={fmt(stats.max)} />
                    <StatRow label="Q1" value={fmt(stats.q1)} />
                    <StatRow label="Q3" value={fmt(stats.q3)} />
                    <StatRow label="IQR" value={fmt(stats.iqr)} />
                    <StatRow label="Asimetría" value={fmt(stats.skewness)} />
                    <StatRow label="Curtosis" value={fmt(stats.kurtosis)} />
                  </div>
                )}

                {stats.type === "categorical" && (
                  <div className="bg-gray-50 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-2">Frecuencias</div>
                    {(stats.topValues ?? []).slice(0, 8).map(({ value, count }) => (
                      <div key={value} className="flex justify-between text-xs py-0.5 border-b border-gray-100">
                        <span className="text-gray-600 truncate">{value || "–"}</span>
                        <span className="font-mono text-gray-500 ml-2">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Missing bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Cobertura</span>
                  <span>{(100 - parseFloat(missingPct)).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full"
                    style={{ width: `${100 - parseFloat(missingPct)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
