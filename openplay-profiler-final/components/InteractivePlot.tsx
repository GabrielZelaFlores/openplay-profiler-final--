"use client";
import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { parseNumericValue, pearsonCorrelationFromRows } from "@/lib/data-utils";
import { Filter, TrendingUp, X } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function InteractivePlot() {
  const { columns, filteredRows, columnStats, setSelectedParticipant, setSelectedRecordIds, clearSelectedRecordIds } = useStore();

  const [xCol, setXCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [colorCol, setColorCol] = useState("");
  const [showTrend, setShowTrend] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const numericCols = useMemo(
    () => columns.filter((c) => columnStats[c]?.type === "numeric"),
    [columns, columnStats]
  );

  const pearsonR = useMemo(() => {
    if (!xCol || !yCol || xCol === yCol) return null;
    return pearsonCorrelationFromRows(filteredRows, xCol, yCol);
  }, [xCol, yCol, filteredRows]);

  const rowById = useMemo(() => {
    const map = new Map<string, (typeof filteredRows)[number]>();
    for (const row of filteredRows) map.set(String(row["record_id"]), row);
    return map;
  }, [filteredRows]);

  const selectedRows = useMemo(
    () => selectedIds.map((id) => rowById.get(id)).filter((row): row is (typeof filteredRows)[number] => Boolean(row)),
    [selectedIds, rowById, filteredRows]
  );

  const toggleSelectedId = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id].slice(-80)
    );
  };

  const selectedProfile = useMemo(() => {
    if (selectedRows.length < 2) return [];
    return numericCols
      .map((col) => {
        const groupValues = selectedRows
          .map((row) => parseNumericValue(row[col]))
          .filter(Number.isFinite);
        const allValues = filteredRows
          .map((row) => parseNumericValue(row[col]))
          .filter(Number.isFinite);
        if (!groupValues.length || allValues.length < 2) return null;
        const groupMean = groupValues.reduce((sum, value) => sum + value, 0) / groupValues.length;
        const globalMean = allValues.reduce((sum, value) => sum + value, 0) / allValues.length;
        const variance = allValues.reduce((sum, value) => sum + (value - globalMean) ** 2, 0) / allValues.length;
        const std = Math.sqrt(variance) || 1;
        return {
          col,
          groupMean,
          globalMean,
          zDiff: (groupMean - globalMean) / std,
          coverage: groupValues.length / selectedRows.length,
        };
      })
      .filter((item): item is { col: string; groupMean: number; globalMean: number; zDiff: number; coverage: number } => Boolean(item))
      .sort((a, b) => Math.abs(b.zDiff) - Math.abs(a.zDiff))
      .slice(0, 10)
      .reverse();
  }, [selectedRows, numericCols, filteredRows]);

  const plotData = useMemo(() => {
    if (!xCol || !yCol) return [];

    const xVals: number[] = [];
    const yVals: number[] = [];
    const colorVals: number[] = [];
    const texts: string[] = [];
    const customIds: string[] = [];

    for (const row of filteredRows) {
      const x = parseNumericValue(row[xCol]);
      const y = parseNumericValue(row[yCol]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      xVals.push(x);
      yVals.push(y);
      customIds.push(String(row["record_id"]));
      const cv = parseNumericValue(row[colorCol]);
      colorVals.push(Number.isFinite(cv) ? cv : 0);
      texts.push(`ID: ${row["record_id"]}<br>${xCol}: ${x.toFixed(2)}<br>${yCol}: ${y.toFixed(2)}`);
    }

    const scatter = {
      type: "scatter" as const,
      mode: "markers" as const,
      x: xVals,
      y: yVals,
      marker: colorCol
        ? { color: colorVals, colorscale: "Viridis" as const, showscale: true, size: 6, opacity: 0.7 }
        : { color: "#5f725c", size: 6, opacity: 0.7, colorscale: undefined as never, showscale: false },
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

    const selectedPoints = selectedIds
      .map((id) => {
        const row = rowById.get(id);
        if (!row) return null;
        const x = parseNumericValue(row[xCol]);
        const y = parseNumericValue(row[yCol]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { id, x, y };
      })
      .filter((point): point is { id: string; x: number; y: number } => Boolean(point));

    if (selectedPoints.length > 0) {
      result.push({
        type: "scatter" as const,
        mode: "text+markers" as const,
        x: selectedPoints.map((point) => point.x),
        y: selectedPoints.map((point) => point.y),
        text: selectedPoints.map((point) => point.id),
        textposition: "top center" as const,
        customdata: selectedPoints.map((point) => point.id),
        marker: {
          size: 13,
          color: "rgba(239,68,68,0.95)",
          symbol: "circle-open",
          line: { color: "white", width: 2 },
        },
        hovertemplate: "Seleccionado: %{text}<extra></extra>",
        name: "Seleccionados",
      });
    }

    return result;
  }, [xCol, yCol, colorCol, filteredRows, showTrend, selectedIds, rowById]);

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
            dragmode: "lasso",
            font: { size: 11 },
            legend: { orientation: "h", y: -0.15 },
          }}
          config={{ displayModeBar: true, modeBarButtonsToRemove: ["toImage"], responsive: true }}
          style={{ width: "100%" }}
          onClick={(data) => {
            const recordId = data.points[0]?.customdata as string | undefined;
            if (recordId !== undefined) {
              toggleSelectedId(recordId);
              const row = filteredRows.find((r) => String(r["record_id"]) === recordId);
              if (row) setSelectedParticipant(row);
            }
          }}
          onSelected={(event?: { points?: { customdata?: unknown }[] }) => {
            const ids = (event?.points ?? [])
              .map((point) => String(point.customdata ?? ""))
              .filter((id) => id && rowById.has(id));
            if (ids.length) setSelectedIds(Array.from(new Set(ids)).slice(0, 80));
          }}
        />
      )}

      {xCol && yCol && (
        <p className="text-[10px] text-gray-400 mt-1">{filteredRows.length.toLocaleString("es")} registros en el gráfico</p>
      )}

      {xCol && yCol && (
        <div className="mt-3 border border-gray-100 rounded p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-700">Comparacion de seleccion</div>
              <p className="text-xs text-gray-400 mt-0.5">
                Usa click o lazo en Plotly para seleccionar participantes y comparar su perfil contra el total filtrado.
              </p>
            </div>
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={() => setSelectedRecordIds(selectedIds)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
                >
                  <Filter size={12} /> Usar como filtro global
                </button>
                <button
                  onClick={clearSelectedRecordIds}
                  className="px-2 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:border-orange-300"
                >
                  Quitar filtro global
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:border-orange-300"
                >
                  <X size={12} /> Limpiar
                </button>
              </div>
            )}
          </div>

          {selectedIds.length === 0 ? (
            <div className="text-xs text-gray-400 border border-dashed border-gray-200 rounded p-3">
              Todavia no hay puntos seleccionados. Activa el lazo del grafico o haz click sobre puntos individuales.
            </div>
          ) : (
            <div className="text-xs text-gray-600">
              Seleccionados: <b>{selectedIds.length}</b> participantes. La comparacion usa variables numericas y diferencias estandarizadas.
            </div>
          )}

          {selectedProfile.length > 0 && (
            <div className="border border-gray-100 rounded overflow-hidden">
              <Plot
                data={[{
                  type: "bar",
                  orientation: "h",
                  x: selectedProfile.map((item) => item.zDiff),
                  y: selectedProfile.map((item) => item.col),
                  marker: {
                    color: selectedProfile.map((item) => item.zDiff >= 0 ? "#4f647f" : "#9b6f45"),
                  },
                  customdata: selectedProfile.map((item) => [
                    item.groupMean.toFixed(3),
                    item.globalMean.toFixed(3),
                    `${(item.coverage * 100).toFixed(0)}%`,
                  ]),
                  hovertemplate: "Diferencia std: %{x:.2f}<br>Media seleccion: %{customdata[0]}<br>Media global: %{customdata[1]}<br>Cobertura seleccion: %{customdata[2]}<extra></extra>",
                } as import("plotly.js").Data]}
                layout={{
                  height: Math.max(260, selectedProfile.length * 28 + 90),
                  margin: { t: 20, r: 20, b: 40, l: 160 },
                  paper_bgcolor: "white",
                  plot_bgcolor: "#fafafa",
                  xaxis: { title: { text: "Diferencia estandarizada vs total", font: { size: 10 } }, zeroline: true },
                  yaxis: { automargin: true },
                  font: { size: 10 },
                  showlegend: false,
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%" }}
              />
              <div className="px-2 py-1 text-xs text-gray-500 border-t border-gray-100">
                Barras azules: seleccion por encima del promedio. Barras naranjas: seleccion por debajo del promedio.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
