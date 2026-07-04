"use client";
import { BarChart3, CheckCircle2, Database, Layers, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";

export default function DataMiningOverview() {
  const { rows, columns, columnStats } = useStore();
  if (!rows.length) return null;

  const stats = Object.values(columnStats);
  const numericCount = stats.filter((stat) => stat.type === "numeric").length;
  const categoricalCount = stats.filter((stat) => stat.type === "categorical").length;
  const avgMissing = stats.length
    ? stats.reduce((sum, stat) => sum + stat.missingPct, 0) / stats.length
    : 0;
  const highMissing = stats
    .filter((stat) => stat.missingPct >= 40)
    .sort((a, b) => b.missingPct - a.missingPct)
    .slice(0, 5);

  const availabilityFlags = [
    "has_biweekly",
    "has_daily",
    "has_steam",
    "has_xbox",
    "has_nintendo",
    "has_android",
    "has_ios",
    "has_cognitive",
    "has_timeuse",
  ].filter((col) => columns.includes(col));

  const availability = availabilityFlags.map((col) => {
    const count = rows.filter((row) => row[col] === 1 || row[col] === true || row[col] === "1").length;
    return { col, count, pct: rows.length ? (count / rows.length) * 100 : 0 };
  });

  const readiness =
    numericCount >= 20 && avgMissing < 35
      ? {
          label: "Listo para mineria exploratoria",
          tone: "text-emerald-700 bg-emerald-50 border-emerald-100",
          icon: <CheckCircle2 size={14} />,
        }
      : {
          label: "Revisar cobertura antes de concluir",
          tone: "text-yellow-700 bg-yellow-50 border-yellow-100",
          icon: <AlertTriangle size={14} />,
        };

  return (
    <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <BarChart3 size={15} className="text-orange-500" /> Resumen BI y mineria de datos
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Diagnostico inicial para decidir si el dataset esta listo para profiling, reduccion dimensional y segmentacion.
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs border rounded px-2 py-1 ${readiness.tone}`}>
          {readiness.icon} {readiness.label}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="bg-gray-50 border border-gray-100 rounded p-2">
          <div className="text-gray-500 flex items-center gap-1"><Database size={12} /> Participantes</div>
          <div className="font-semibold text-gray-800">{rows.length.toLocaleString("es")}</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded p-2">
          <div className="text-gray-500 flex items-center gap-1"><Layers size={12} /> Variables</div>
          <div className="font-semibold text-gray-800">{columns.length.toLocaleString("es")}</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded p-2">
          <div className="text-gray-500">Numericas / categoricas</div>
          <div className="font-semibold text-gray-800">{numericCount} / {categoricalCount}</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded p-2">
          <div className="text-gray-500">Faltantes promedio</div>
          <div className="font-semibold text-gray-800">{avgMissing.toFixed(1)}%</div>
        </div>
      </div>

      {availability.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Cobertura por fuente</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
            {availability.map((item) => (
              <div key={item.col} className="text-xs border border-gray-100 rounded px-2 py-1">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-600 truncate">{item.col}</span>
                  <span className="font-mono text-gray-700">{item.pct.toFixed(0)}%</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, item.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <div className="border border-blue-100 bg-blue-50 rounded p-2 text-blue-700">
          Flujo recomendado: revisa cobertura, selecciona el vector integral, valida correlaciones, ejecuta PCA/UMAP y defiende clusters solo si tienen separacion, balance e interpretacion en variables originales.
        </div>
        <div className="border border-yellow-100 bg-yellow-50 rounded p-2 text-yellow-700">
          Variables con muchos faltantes: {highMissing.length ? highMissing.map((stat) => `${stat.name} (${stat.missingPct.toFixed(0)}%)`).join(", ") : "no hay variables criticas por encima de 40%."}
        </div>
      </div>
    </div>
  );
}
