"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { pearsonCorrelationFromRows } from "@/lib/data-utils";
import { Grid } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function CorrelationHeatmap() {
  const { selectedVariables, filteredRows, columnStats } = useStore();

  const numericVars = useMemo(
    () => selectedVariables.filter((v) => columnStats[v]?.type === "numeric"),
    [selectedVariables, columnStats]
  );

  const corrMatrix = useMemo(() => {
    if (numericVars.length < 2) return null;
    const n = numericVars.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        matrix[i][j] = i === j ? 1 : pearsonCorrelationFromRows(filteredRows, numericVars[i], numericVars[j]);
      }
    }
    return matrix;
  }, [numericVars, filteredRows]);

  if (numericVars.length < 2) {
    return (
      <div className="bg-white border border-gray-200 rounded p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Grid size={15} className="text-orange-500" /> Matriz de correlaciones
        </h2>
        <p className="text-xs text-gray-400">Selecciona al menos 2 variables numéricas en el vector de características.</p>
      </div>
    );
  }

  const labels = numericVars;
  const z = corrMatrix!;

  const highCorrPairs: { a: string; b: string; r: number }[] = [];
  for (let i = 0; i < numericVars.length; i++) {
    for (let j = i + 1; j < numericVars.length; j++) {
      const r = z[i][j];
      if (!isNaN(r) && Math.abs(r) > 0.7) {
        highCorrPairs.push({ a: numericVars[i], b: numericVars[j], r });
      }
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <Grid size={15} className="text-orange-500" /> Correlaciones (Pearson)
      </h2>

      <Plot
        data={[{
          type: "heatmap",
          z: z as number[][],
          x: labels,
          y: labels,
          colorscale: "RdBu",
          zmin: -1,
          zmax: 1,
          showscale: true,
          hoverongaps: false,
          hovertemplate: "r = %{z:.3f}<extra></extra>",
        }]}
        layout={{
          height: Math.max(300, numericVars.length * 40 + 80),
          margin: { t: 10, r: 60, b: 100, l: 100 },
          paper_bgcolor: "white",
          plot_bgcolor: "white",
          xaxis: { tickangle: -45, tickfont: { size: 10 } },
          yaxis: { tickfont: { size: 10 } },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />

      {highCorrPairs.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-gray-500 mb-1">
            ⚠️ Pares con correlación alta (&gt;0.7) — solo informativo:
          </div>
          <div className="space-y-1">
            {highCorrPairs.map(({ a, b, r }) => (
              <div key={`${a}-${b}`} className="text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1 flex justify-between">
                <span className="truncate">{a} ↔ {b}</span>
                <span className="font-mono ml-2">{r.toFixed(3)}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Las variables NO se eliminan automáticamente por correlación.</p>
        </div>
      )}
    </div>
  );
}
