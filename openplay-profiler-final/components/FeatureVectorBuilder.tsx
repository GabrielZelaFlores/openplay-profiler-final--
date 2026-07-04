"use client";
import { useStore } from "@/lib/store";
import { X, Trash2, Check, ChevronDown, ChevronRight } from "lucide-react";
import { fmt } from "@/lib/data-utils";
import { useState } from "react";
import { RECOMMENDED_PROJECT_VECTOR } from "@/lib/openplay-vector";

const GROUPS = [
  { label: "Demográficas (intake)", prefix: ["age","gender","country","cohort","edu_level","employment","marital_status","ethnicity","height","weight","dependents","num_platforms"] },
  { label: "Neurodiversidad", prefix: ["neuro_"] },
  { label: "GDT (adicción)", prefix: ["bw_gdt","gdt_"] },
  { label: "PROMIS (depresión)", prefix: ["bw_promis","promis_"] },
  { label: "WEMWBS (bienestar)", prefix: ["bw_wemwbs","wemwbs_","intake_wemwbs"] },
  { label: "BANGS", prefix: ["bw_bangs","bangs_"] },
  { label: "BFI Personalidad", prefix: ["bw_bfi"] },
  { label: "TROJAN", prefix: ["bw_trojan"] },
  { label: "Sueño / MCTQ / EPS / PSQI", prefix: ["bw_mctq","bw_eps","bw_psqi"] },
  { label: "Valores del juego", prefix: ["bw_gaming_value","bw_positives","bw_problematic"] },
  { label: "Telemetria derivada", prefix: ["telem_"] },
  { label: "Telemetría Steam", prefix: ["steam_"] },
  { label: "Telemetría Xbox", prefix: ["xbox_"] },
  { label: "Telemetría Nintendo", prefix: ["nintendo_"] },
  { label: "Telemetría Android", prefix: ["android_"] },
  { label: "Telemetría iOS", prefix: ["ios_"] },
  { label: "Tareas cognitivas", prefix: ["cog_"] },
  { label: "Uso del tiempo", prefix: ["timeuse_"] },
  { label: "Encuesta diaria", prefix: ["daily_"] },
  { label: "Indicadores", prefix: ["has_","num_telemetry"] },
];

export default function FeatureVectorBuilder() {
  const { columns, selectedVariables, toggleVariable, clearVariables, columnStats, filteredRows } = useStore();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const matchesGroup = (col: string, prefixes: string[]) =>
    prefixes.some((p) => col.startsWith(p) || col === p);

  const toggleGroup = (label: string) => {
    const s = new Set(openGroups);
    if (s.has(label)) s.delete(label); else s.add(label);
    setOpenGroups(s);
  };

  const selectAllInGroup = (prefixes: string[]) => {
    const cols = columns.filter((c) => matchesGroup(c, prefixes));
    for (const c of cols) if (!selectedVariables.includes(c)) toggleVariable(c);
  };

  const selectRecommendedProjectVector = () => {
    const available = RECOMMENDED_PROJECT_VECTOR.filter((c) => columns.includes(c));
    for (const col of available) {
      if (!selectedVariables.includes(col)) toggleVariable(col);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">
            Vector de características
            <span className="ml-2 text-orange-500 font-bold">{selectedVariables.length} variables</span>
          </h2>
          {selectedVariables.length > 0 && (
            <button onClick={clearVariables} className="text-xs flex items-center gap-1 text-gray-400 hover:text-red-500">
              <Trash2 size={12} /> Limpiar
            </button>
          )}
        </div>

        <button
          onClick={selectRecommendedProjectVector}
          className="mb-2 text-xs px-3 py-1.5 rounded border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100"
        >
          Seleccionar vector integral recomendado
        </button>
        <p className="text-xs text-gray-500 mb-2">
          Cubre demografia, bienestar, riesgo de juego problematico, telemetria, actividad diaria, cognicion y uso del tiempo.
        </p>

        {/* Chips de variables seleccionadas */}
        {selectedVariables.length > 0 && (
          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-2 bg-orange-50 rounded border border-orange-100">
            {selectedVariables.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 text-xs bg-white border border-orange-200 text-orange-700 rounded px-2 py-0.5">
                {v}
                <button onClick={() => toggleVariable(v)} className="hover:text-red-500"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Búsqueda rápida */}
      <div className="px-4 py-2 border-b border-gray-100">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar variable…"
          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
        />
      </div>

      {/* Lista agrupada o búsqueda */}
      <div className="overflow-y-auto max-h-[500px]">
        {search ? (
          /* Resultado de búsqueda plano */
          <div>
            {columns.filter((c) => c.toLowerCase().includes(search.toLowerCase())).slice(0, 60).map((col) => {
              const stats = columnStats[col];
              const sel = selectedVariables.includes(col);
              return (
                <div
                  key={col}
                  onClick={() => toggleVariable(col)}
                  className={`flex items-center justify-between px-4 py-1.5 cursor-pointer border-b border-gray-50 hover:bg-orange-50 ${sel ? "bg-orange-50" : ""}`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? "bg-orange-500 border-orange-500" : "border-gray-300"}`}>
                      {sel && <Check size={9} className="text-white" />}
                    </div>
                    <span className={sel ? "text-orange-700 font-medium" : "text-gray-700"}>{col}</span>
                    <span className={`text-[10px] ${stats?.type === "numeric" ? "text-blue-400" : "text-green-400"}`}>
                      {stats?.type === "numeric" ? "N" : "C"}
                    </span>
                  </div>
                  {stats && (
                    <span className="text-[10px] text-gray-400">{stats.missingPct.toFixed(0)}% falt.</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Grupos */
          GROUPS.map((group) => {
            const groupCols = columns.filter((c) => matchesGroup(c, group.prefix));
            if (groupCols.length === 0) return null;
            const selCount = groupCols.filter((c) => selectedVariables.includes(c)).length;
            const open = openGroups.has(group.label);

            return (
              <div key={group.label} className="border-b border-gray-100">
                <div
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleGroup(group.label)}
                >
                  <div className="flex items-center gap-2 text-xs">
                    {open ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                    <span className="font-medium text-gray-700">{group.label}</span>
                    <span className="text-gray-400">({groupCols.length})</span>
                    {selCount > 0 && (
                      <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded-full">{selCount} sel.</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); selectAllInGroup(group.prefix); }}
                    className="text-[10px] px-2 py-0.5 text-orange-600 hover:bg-orange-50 rounded border border-orange-200"
                  >
                    + todo
                  </button>
                </div>

                {open && groupCols.map((col) => {
                  const stats = columnStats[col];
                  const sel = selectedVariables.includes(col);
                  return (
                    <div
                      key={col}
                      onClick={() => toggleVariable(col)}
                      className={`flex items-center justify-between pl-8 pr-3 py-1.5 cursor-pointer border-t border-gray-50 hover:bg-orange-50 ${sel ? "bg-orange-50" : ""}`}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${sel ? "bg-orange-500 border-orange-500" : "border-gray-300"}`}>
                          {sel && <Check size={8} className="text-white" />}
                        </div>
                        <span className={`truncate max-w-[200px] ${sel ? "text-orange-700 font-medium" : "text-gray-600"}`}>{col}</span>
                      </div>
                      {stats && (
                        <div className="text-[10px] text-gray-400 flex gap-2 shrink-0">
                          {stats.type === "numeric" && <span>μ={fmt(stats.mean, 1)}</span>}
                          <span>{stats.missingPct.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-gray-100 text-xs text-gray-400">
        {filteredRows.length.toLocaleString("es")} participantes disponibles · {selectedVariables.length} variables seleccionadas
      </div>
    </div>
  );
}
