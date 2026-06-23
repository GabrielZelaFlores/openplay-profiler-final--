"use client";
import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { pearsonCorrelationFromRows } from "@/lib/data-utils";
import { TrendingUp } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function InteractivePlot() {
  const { columns, filteredRows, columnStats, setSelectedParticipant } = useStore();

  const [xCol, setXCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [colorCol, setColorCol] = useState("");
  const [showTrend, setShowTrend] = useState(false);

  const numericCols = useMemo(
    () => columns.filter((c) => columnStats[c]?.type === "numeric"),
    [columns, columnStats]
  );

  const pearsonR = useMemo(() => {
    if (!xCol || !yCol || xCol === yCol) return null;
    return pearsonCorrelationFromRows(filteredRows, xCol, yCol);
  }, [xCol, yCol, filteredRows]);

  const plotData = useMemo(() => {
    if (!xCol || !yCol) return [];

    const xVals: number[] = [];
    const yVals: number[] = [];
    const colorVals: number[] = [];
    const texts: string[] = [];
    const customIds: string[] = [];

    for (const row of filteredRows) {
      const x = parseFloat(String(row[xCol] ?? ""));
      const y = parseFloat(String(row[yCol] ?? ""));
      if (!isFinite(x) || !isFinite(y)) continue;
      xVals.push(x);
      yVals.push(y);
      customIds.push(String(row["record_id"]));
      const cv = parseFloat(String(row[colorCol] ?? ""));
      colorVals.push(isFinite(cv) ? cv : 0);
      texts.push(`ID: ${row["record_id"]}<br>${xCol}: ${x.toFixed(2)}<br>${yCol}: ${y.toFixed(2)}`);
    }

    const scatter = {
      type: "scatter" as const,
      mode: "markers" as const,
      x: xVals,
      y: yVals,
      marker: colorCol
        ? { color: colorVals, colorscale: "Viridis" as const, showscale: true, size: 6, opacity: 0.7 }
        : { color: "#f97316", size: 6, opacity: 0.7, colorscale: undefined as never, showscale: false },
      text: texts,
      hovertemplate: "%{text}<extra></extra>",
      customdata: customIds,
      name: "Participantes",
    };

    const result: import("plotly.js").Data[] = [scatter];

    if (showTrend && xVals.length > 1) {
      const n = xVals.length;
      const mx = xVals.reduce((a, b) => a + b, 0) / n;
      const my = yVals.reduce((a, b) => a + b, 0) / n;
      let num = 0, denom = 0;
      for (let i = 0; i < n; i++) { num += (xVals[i] - mx) * (yVals[i] - my); denom += (xVals[i] - mx) ** 2; }
      if (denom !== 0) {
        const slope = num / denom;
        const intercept = my - slope * mx;
        const xMin = Math.min(...xVals);
        const xMax = Math.max(...xVals);
        result.push({
          type: "scatter" as const,
          mode: "lines" as const,
          x: [xMin, xMax],
          y: [slope * xMin + intercept, slope * xMax + intercept],
          line: { color: "#1e40af", width: 2 },
          name: "Tendencia",
        });
      }
    }

    return result;
  }, [xCol, yCol, colorCol, filteredRows, showTrend]);

  const Sel = ({ label, value, onChange, cols }: {
    label: string; value: string; onChange: (v: string) => void; cols: string[];
  }) => (
    <div className="flex items-center gap-2 text-xs">
      <label className="text-gray-500 w-14 shrink-0">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs text-gray-700">
        <option value="">— seleccionar —</option>
        {cols.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <TrendingUp size={15} className="text-orange-500" /> Análisis bivariado
      </h2>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Sel label="Eje X" value={xCol} onChange={setXCol} cols={numericCols} />
        <Sel label="Eje Y" value={yCol} onChange={setYCol} cols={numericCols} />
        <Sel label="Color" value={colorCol} onChange={setColorCol} cols={columns} />
        <div className="flex items-center gap-2 text-xs">
          <label className="text-gray-500 w-14">Tendencia</label>
          <button onClick={() => setShowTrend((t) => !t)}
            className={`px-3 py-1 rounded border text-xs ${showTrend ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-600"}`}>
            {showTrend ? "Activada" : "Desactivada"}
          </button>
        </div>
      </div>

      {pearsonR !== null && !isNaN(pearsonR) && (
        <div className="mb-2 text-xs bg-blue-50 border border-blue-200 rounded px-3 py-1.5 flex justify-between">
          <span className="text-blue-700">Correlación de Pearson ({xCol} ↔ {yCol})</span>
          <span className="font-mono font-bold text-blue-800">r = {pearsonR.toFixed(4)}</span>
        </div>
      )}

      {(!xCol || !yCol) ? (
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded">
          Selecciona variables X e Y para el scatter plot
        </div>
      ) : (
        <Plot
          data={plotData}
          layout={{
            height: 380,
            margin: { t: 10, r: 20, b: 50, l: 60 },
            paper_bgcolor: "white",
            plot_bgcolor: "#fafafa",
            xaxis: { title: { text: xCol, font: { size: 11 } } },
            yaxis: { title: { text: yCol, font: { size: 11 } } },
            font: { size: 11 },
            legend: { orientation: "h", y: -0.15 },
          }}
          config={{ displayModeBar: true, modeBarButtonsToRemove: ["toImage"], responsive: true }}
          style={{ width: "100%" }}
          onClick={(data) => {
            const recordId = data.points[0]?.customdata as string | undefined;
            if (recordId !== undefined) {
              const row = filteredRows.find((r) => String(r["record_id"]) === recordId);
              if (row) setSelectedParticipant(row);
            }
          }}
        />
      )}

      {xCol && yCol && (
        <p className="text-[10px] text-gray-400 mt-1">{filteredRows.length.toLocaleString("es")} registros en el gráfico</p>
      )}
    </div>
  );
}
