"use client";
import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, BarChart3 } from "lucide-react";
import { parseNumericValue, pearsonCorrelationFromRows } from "@/lib/data-utils";
import { useStore } from "@/lib/store";

export default function FeatureVectorEvaluation() {
  const { selectedVariables, columnStats, filteredRows } = useStore();

  const evaluation = useMemo(() => {
    const numeric = selectedVariables.filter((v) => columnStats[v]?.type === "numeric");
    const categorical = selectedVariables.filter((v) => columnStats[v]?.type === "categorical");
    const stats = selectedVariables
      .map((name) => columnStats[name])
      .filter(Boolean);

    const avgMissing = stats.length
      ? stats.reduce((sum, stat) => sum + stat.missingPct, 0) / stats.length
      : 0;

    const highMissing = stats
      .filter((stat) => stat.missingPct >= 40)
      .sort((a, b) => b.missingPct - a.missingPct)
      .slice(0, 5);

    const highCorr: { a: string; b: string; r: number }[] = [];
    for (let i = 0; i < numeric.length; i++) {
      for (let j = i + 1; j < numeric.length; j++) {
        const r = pearsonCorrelationFromRows(filteredRows, numeric[i], numeric[j]);
        if (isFinite(r) && Math.abs(r) >= 0.8) {
          highCorr.push({ a: numeric[i], b: numeric[j], r });
        }
      }
    }

    const completeNumericRows = numeric.length
      ? filteredRows.filter((row) =>
          numeric.every((col) => {
            return Number.isFinite(parseNumericValue(row[col]));
          })
        ).length
      : 0;
    const completeNumericPct = filteredRows.length
      ? (completeNumericRows / filteredRows.length) * 100
      : 0;

    let score = 0;
    if (selectedVariables.length >= 8) score += 15;
    else if (selectedVariables.length >= 4) score += 10;
    if (numeric.length >= 5) score += 25;
    else if (numeric.length >= 3) score += 18;
    else if (numeric.length >= 2) score += 10;
    if (avgMissing < 15) score += 20;
    else if (avgMissing < 35) score += 12;
    if (completeNumericPct >= 80) score += 20;
    else if (completeNumericPct >= 60) score += 12;
    if (highCorr.length <= 2) score += 20;
    else if (highCorr.length <= 5) score += 12;

    const level =
      score >= 80 ? "Listo para proyeccion y clustering" :
      score >= 55 ? "Aceptable, revisar antes de concluir" :
      "Incompleto para analisis robusto";

    const tone =
      score >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-100" :
      score >= 55 ? "text-yellow-700 bg-yellow-50 border-yellow-100" :
      "text-red-700 bg-red-50 border-red-100";

    return {
      numeric,
      categorical,
      avgMissing,
      highMissing,
      highCorr,
      completeNumericRows,
      completeNumericPct,
      score,
      level,
      tone,
    };
  }, [selectedVariables, columnStats, filteredRows]);

  if (selectedVariables.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded p-4">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <BarChart3 size={15} className="text-orange-500" /> Evaluacion del vector
        </h2>
        <p className="text-xs text-gray-500 mt-2">
          Selecciona variables para evaluar cobertura, tipos de datos, redundancia y preparacion para PCA, UMAP, t-SNE y clustering.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <BarChart3 size={15} className="text-orange-500" /> Evaluacion del vector
        </h2>
        <span className={`text-xs border rounded px-2 py-1 ${evaluation.tone}`}>
          {evaluation.score}/100 · {evaluation.level}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="bg-gray-50 rounded p-2">
          <div className="text-gray-500">Variables</div>
          <div className="font-semibold text-gray-800">{selectedVariables.length}</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-gray-500">Numericas</div>
          <div className="font-semibold text-gray-800">{evaluation.numeric.length}</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-gray-500">Categoricas</div>
          <div className="font-semibold text-gray-800">{evaluation.categorical.length}</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-gray-500">Faltantes prom.</div>
          <div className="font-semibold text-gray-800">{evaluation.avgMissing.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-50 rounded p-2 col-span-2 md:col-span-4">
          <div className="text-gray-500">Casos completos en variables numericas seleccionadas</div>
          <div className="font-semibold text-gray-800">
            {evaluation.completeNumericRows.toLocaleString("es")} de {filteredRows.length.toLocaleString("es")} ({evaluation.completeNumericPct.toFixed(1)}%)
          </div>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        {evaluation.numeric.length < 3 ? (
          <div className="flex gap-2 text-yellow-700 bg-yellow-50 border border-yellow-100 rounded p-2">
            <AlertTriangle size={13} /> Agrega al menos 3 variables numericas para una reduccion dimensional mas estable.
          </div>
        ) : (
          <div className="flex gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded p-2">
            <CheckCircle2 size={13} /> El vector tiene suficientes variables numericas para proyeccion 2D.
          </div>
        )}

        {evaluation.highMissing.length > 0 && (
          <div className="text-yellow-700 bg-yellow-50 border border-yellow-100 rounded p-2">
            Variables con muchos faltantes: {evaluation.highMissing.map((stat) => `${stat.name} (${stat.missingPct.toFixed(0)}%)`).join(", ")}.
          </div>
        )}

        {evaluation.highCorr.length > 0 && (
          <div className="text-blue-700 bg-blue-50 border border-blue-100 rounded p-2">
            Pares altamente correlacionados: {evaluation.highCorr.slice(0, 3).map((p) => `${p.a} ~ ${p.b} (r=${p.r.toFixed(2)})`).join("; ")}.
          </div>
        )}

        {evaluation.categorical.length > 0 && (
          <div className="text-gray-600 bg-gray-50 border border-gray-100 rounded p-2">
            Nota metodologica: PCA, UMAP, t-SNE y clustering usan solo variables numericas. Las categoricas seleccionadas sirven para filtrar, comparar e interpretar, pero no entran directamente al vector proyectado.
          </div>
        )}
      </div>
    </div>
  );
}
