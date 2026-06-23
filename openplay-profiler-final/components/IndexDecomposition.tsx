"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { ChevronDown, ChevronRight, Plus, Minus, Check } from "lucide-react";
import { fmt } from "@/lib/data-utils";
import { getQuestionInfo } from "@/lib/question-metadata";

export default function IndexDecomposition() {
  const { indexGroups, selectedVariables, toggleVariable, selectGroup, columnStats, filteredRows } = useStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["GDT", "PROMIS", "WEMWBS", "BANGS"]));

  if (!indexGroups.length) {
    return (
      <div className="bg-white border border-gray-200 rounded p-4">
        <p className="text-xs text-gray-400">No se detectaron grupos de encuestas.</p>
      </div>
    );
  }

  const toggle = (name: string) => {
    const s = new Set(expanded);
    if (s.has(name)) s.delete(name); else s.add(name);
    setExpanded(s);
  };

  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Desglose de encuestas e índices</h2>
      <p className="text-xs text-gray-400 mb-3">
        Selecciona preguntas individuales o índices completos para el análisis.
      </p>

      <div className="space-y-2">
        {indexGroups.map((group) => {
          const isOpen = expanded.has(group.name);
          const allSelected = group.items.every((i) => selectedVariables.includes(i));
          const anySelected = group.items.some((i) => selectedVariables.includes(i));

          return (
            <div key={group.name} className="border border-gray-200 rounded overflow-hidden">
              {/* Header del grupo */}
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer" onClick={() => toggle(group.name)}>
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                  <span className="text-sm font-medium text-gray-700">{group.name}</span>
                  <span className="text-xs text-gray-400">({group.items.length} ítems)</span>
                  {anySelected && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                      {group.items.filter((i) => selectedVariables.includes(i)).length} seleccionadas
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); selectGroup(group); }}
                  className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center gap-1"
                  title="Seleccionar todo el grupo"
                >
                  <Plus size={10} /> Seleccionar todo
                </button>
              </div>

              {/* Ítems */}
              {isOpen && (
                <div className="divide-y divide-gray-100">
                  {/* Total si existe */}
                  {group.totalCol && (
                    <div
                      className={`flex items-center justify-between px-4 py-1.5 cursor-pointer hover:bg-orange-50 bg-orange-25 ${selectedVariables.includes(group.totalCol) ? "bg-orange-50" : ""}`}
                      onClick={() => toggleVariable(group.totalCol!)}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedVariables.includes(group.totalCol) ? "bg-orange-500 border-orange-500" : "border-gray-300"}`}>
                          {selectedVariables.includes(group.totalCol) && <Check size={9} className="text-white" />}
                        </div>
                        <span className="font-medium text-orange-700">{group.totalCol}</span>
                        <span className="text-gray-400">(total calculado)</span>
                      </div>
                      {columnStats[group.totalCol] && (
                        <div className="text-xs text-gray-400">
                          μ={fmt(columnStats[group.totalCol].mean)} · {columnStats[group.totalCol].missingPct.toFixed(0)}% falt.
                        </div>
                      )}
                    </div>
                  )}

                  {group.items.map((item) => {
                    const stats = columnStats[item];
                    const isSelected = selectedVariables.includes(item);
                    const question = getQuestionInfo(item);
                    return (
                      <div
                        key={item}
                        className={`flex items-center justify-between px-4 py-1.5 cursor-pointer hover:bg-orange-50 ${isSelected ? "bg-orange-50" : ""}`}
                        onClick={() => toggleVariable(item)}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "bg-orange-500 border-orange-500" : "border-gray-300"}`}>
                          {isSelected && <Check size={9} className="text-white" />}
                        </div>
                          <div>
                            <div className="text-gray-700">{item}</div>
                            {question && (
                              <div className="text-[10px] text-gray-400 max-w-[360px] truncate" title={`${question.measure}: ${question.label}`}>
                                {question.measure}: {question.label}
                              </div>
                            )}
                          </div>
                        </div>
                        {stats && (
                          <div className="text-xs text-gray-400 flex gap-3">
                            {stats.type === "numeric" && <span>μ={fmt(stats.mean)}</span>}
                            <span>{stats.missingPct.toFixed(0)}% falt.</span>
                            {stats.unique <= 7 && stats.type === "numeric" && (
                              <span>{stats.unique} valores</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
