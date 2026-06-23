"use client";
import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { runPCA, runUMAP, runTSNE } from "@/lib/dimensionality-utils";
import { rowsToCSV, downloadCSV } from "@/lib/data-utils";
import { runDBSCAN, runHierarchicalSingleLink, runKMeans, type ClusterResult } from "@/lib/clustering-utils";
import { Activity, Download, AlertTriangle, MousePointer2, X } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Method = "pca" | "umap" | "tsne";
type ImputeMethod = "mean" | "zero" | "drop";
type ClusteringMethod = "kmeans" | "hierarchical-single" | "dbscan";

const COLOR_VARS = [
  "gdt_total","promis_total","wemwbs_total","bangs_total","age","num_platforms",
  "telem_nocturnal_sessions","telem_total_sessions","steam_playtime_2weeks_min",
  "xbox_total_sessions","steam_unique_games","cog_mean_rt","daily_played_days",
  "nintendo_total_sessions","android_total_minutes","ios_total_minutes",
];

const CLUSTER_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#f97316", "#0891b2",
  "#be123c", "#4f46e5", "#65a30d", "#c026d3", "#0f766e", "#a16207",
];

export default function DimensionalityReduction() {
  const { filteredRows, selectedVariables, columnStats, addDimResult, dimResults, setSelectedParticipant, setSelectedRecordIds, clearSelectedRecordIds, rows } = useStore();

  const [method, setMethod] = useState<Method>("pca");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [colorVar, setColorVar] = useState("gdt_total");
  const [impute, setImpute] = useState<ImputeMethod>("mean");

  const [nNeighbors, setNNeighbors] = useState(15);
  const [minDist, setMinDist] = useState(0.1);
  const [spread, setSpread] = useState(1);

  const [perplexity, setPerplexity] = useState(30);
  const [iterations, setIterations] = useState(300);
  const [learningRate, setLearningRate] = useState(200);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manualId, setManualId] = useState("");
  const [caseNote, setCaseNote] = useState("");
  const [clusteringMethod, setClusteringMethod] = useState<ClusteringMethod>("kmeans");
  const [clusterCount, setClusterCount] = useState(4);
  const [dbscanEps, setDbscanEps] = useState(1);
  const [dbscanMinPts, setDbscanMinPts] = useState(8);
  const [clusterResult, setClusterResult] = useState<ClusterResult | null>(null);
  const [clusterError, setClusterError] = useState<string | null>(null);

  const numericSelected = selectedVariables.filter((v) => columnStats[v]?.type === "numeric");
  const currentResult = dimResults.find((r) => r.method === method);
  const rowById = useMemo(() => {
    const map = new Map<string, (typeof rows)[number]>();
    for (const row of rows) map.set(String(row["record_id"]), row);
    return map;
  }, [rows]);

  const coordById = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const coord of currentResult?.coordinates ?? []) {
      map.set(String(coord.record_id), { x: coord.x, y: coord.y });
    }
    return map;
  }, [currentResult]);

  const selectedRows = useMemo(
    () => selectedIds.map((id) => rowById.get(id)).filter((row): row is (typeof rows)[number] => Boolean(row)),
    [selectedIds, rowById, rows]
  );

  const zStats = useMemo(() => {
    const stats: Record<string, { mean: number; std: number }> = {};
    for (const col of numericSelected) {
      const vals = filteredRows
        .map((r) => parseFloat(String(r[col] ?? "")))
        .filter((n) => isFinite(n));
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const variance = vals.length ? vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length : 0;
      stats[col] = { mean, std: Math.sqrt(variance) || 1 };
    }
    return stats;
  }, [numericSelected, filteredRows]);

  const pairSummary = useMemo(() => {
    if (selectedIds.length < 2) return null;
    const [aId, bId] = selectedIds;
    const a = rowById.get(aId);
    const b = rowById.get(bId);
    const ca = coordById.get(aId);
    const cb = coordById.get(bId);
    if (!a || !b || !ca || !cb) return null;
    const distance = Math.sqrt((ca.x - cb.x) ** 2 + (ca.y - cb.y) ** 2);
    const variables = numericSelected.map((col) => {
      const aVal = parseFloat(String(a[col] ?? ""));
      const bVal = parseFloat(String(b[col] ?? ""));
      const hasA = isFinite(aVal);
      const hasB = isFinite(bVal);
      const diff = hasA && hasB ? bVal - aVal : NaN;
      const pct = hasA && hasB && aVal !== 0 ? (diff / Math.abs(aVal)) * 100 : NaN;
      const { mean, std } = zStats[col] ?? { mean: 0, std: 1 };
      const aStd = hasA ? (aVal - mean) / std : NaN;
      const bStd = hasB ? (bVal - mean) / std : NaN;
      return { col, aVal, bVal, diff, pct, aStd, bStd, stdDiff: bStd - aStd };
    });
    return { aId, bId, distance, variables };
  }, [selectedIds, rowById, coordById, numericSelected, zStats]);

  const groupSummary = useMemo(() => {
    if (selectedRows.length < 3) return null;
    return numericSelected.map((col) => {
      const groupVals = selectedRows
        .map((r) => parseFloat(String(r[col] ?? "")))
        .filter((n) => isFinite(n));
      const allVals = filteredRows
        .map((r) => parseFloat(String(r[col] ?? "")))
        .filter((n) => isFinite(n));
      const groupMean = groupVals.length ? groupVals.reduce((a, b) => a + b, 0) / groupVals.length : NaN;
      const generalMean = allVals.length ? allVals.reduce((a, b) => a + b, 0) / allVals.length : NaN;
      return {
        col,
        groupMean,
        generalMean,
        diff: isFinite(groupMean) && isFinite(generalMean) ? groupMean - generalMean : NaN,
      };
    });
  }, [selectedRows, numericSelected, filteredRows]);

  const run = useCallback(async () => {
    if (numericSelected.length < 2) { setError("Selecciona al menos 2 variables numéricas."); return; }
    if (filteredRows.length < 5) { setError("Se necesitan al menos 5 participantes."); return; }
    setError(null);
    setRunning(true);
    setProgress(0);

    try {
      if (method === "pca") {
        const result = runPCA(filteredRows, numericSelected, impute);
        addDimResult({ method: "pca", coordinates: result.coordinates, metadata: result.metadata });
        setSelectedIds([]);
        setClusterResult(null);
        setCaseNote("");
        setProgress(100);
      } else if (method === "umap") {
        setProgress(5);
        const result = await runUMAP(filteredRows, numericSelected, { nNeighbors, minDist, spread }, impute);
        addDimResult({ method: "umap", coordinates: result.coordinates, metadata: result.metadata });
        setSelectedIds([]);
        setClusterResult(null);
        setCaseNote("");
        setProgress(100);
      } else {
        const result = await runTSNE(
          filteredRows, numericSelected,
          { perplexity, iterations, learningRate },
          impute,
          (pct) => setProgress(pct)
        );
        addDimResult({ method: "tsne", coordinates: result.coordinates, metadata: result.metadata });
        setSelectedIds([]);
        setClusterResult(null);
        setCaseNote("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [method, numericSelected, filteredRows, impute, nNeighbors, minDist, spread,
      perplexity, iterations, learningRate, addDimResult]);

  const toggleSelectedId = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id].slice(-30)
    );
  };

  const addManualId = () => {
    const id = manualId.trim();
    if (!id || !coordById.has(id)) return;
    setSelectedIds((current) => current.includes(id) ? current : [...current, id].slice(-30));
    setManualId("");
  };

  const fmtNum = (n: number, dec = 3) => isFinite(n) ? n.toFixed(dec) : "-";

  const runClustering = () => {
    if (!currentResult) return;
    setClusterError(null);
    try {
      const points = currentResult.coordinates.map((coord) => ({
        record_id: coord.record_id,
        x: coord.x,
        y: coord.y,
      }));
      const result =
        clusteringMethod === "kmeans"
          ? runKMeans(points, clusterCount)
          : clusteringMethod === "hierarchical-single"
            ? runHierarchicalSingleLink(points, clusterCount)
            : runDBSCAN(points, dbscanEps, dbscanMinPts);
      setClusterResult(result);
    } catch (e) {
      setClusterError(e instanceof Error ? e.message : String(e));
    }
  };

  const pcaVarianceSummary = (() => {
    if (method !== "pca" || !currentResult?.metadata.explainedVariance) return null;
    const pc1 = currentResult.metadata.explainedVariance[0] ?? 0;
    const pc2 = currentResult.metadata.explainedVariance[1] ?? 0;
    const cumulative = pc1 + pc2;
    const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

    let level = "baja";
    let tone = "text-red-700 bg-red-50 border-red-100";
    let message =
      "La proyeccion en 2D pierde una parte importante de la variabilidad. Conviene revisar variables, imputacion o usar mas componentes.";

    if (cumulative >= 0.8) {
      level = "alta";
      tone = "text-emerald-700 bg-emerald-50 border-emerald-100";
      message =
        "La proyeccion en 2D conserva gran parte de la informacion original y es adecuada para explorar patrones visuales.";
    } else if (cumulative >= 0.6) {
      level = "moderada";
      tone = "text-yellow-700 bg-yellow-50 border-yellow-100";
      message =
        "La proyeccion en 2D conserva una parte razonable de la informacion, pero la lectura visual debe complementarse con otras variables.";
    }

    return { pc1, pc2, cumulative, pct, level, tone, message };
  })();

  const clusterEvaluation = (() => {
    if (!clusterResult || !currentResult) return null;
    const total = currentResult.coordinates.length || 1;
    const realClusters = clusterResult.clusters.filter((cluster) => cluster.label !== -1);
    const largest = realClusters[0];
    const largestPct = largest ? largest.count / total : 0;
    const noisePct = clusterResult.noiseCount / total;

    if (realClusters.length <= 1 && clusterResult.method === "dbscan") {
      return {
        tone: "text-yellow-700 bg-yellow-50 border-yellow-100",
        title: "Separacion debil",
        message: `DBSCAN encontro ${realClusters.length} cluster principal y ${(noisePct * 100).toFixed(1)}% de ruido. En esta configuracion no hay varios grupos densos claramente separados.`,
      };
    }

    if (largestPct >= 0.85) {
      return {
        tone: "text-red-700 bg-red-50 border-red-100",
        title: "No usar como perfiles",
        message: `El cluster mas grande contiene ${(largestPct * 100).toFixed(1)}% de los puntos. Este resultado separa atipicos, no grupos comparables. Prueba K-means, UMAP o ajusta el vector antes de interpretar perfiles.`,
      };
    }

    if (noisePct >= 0.3) {
      return {
        tone: "text-yellow-700 bg-yellow-50 border-yellow-100",
        title: "Mucho ruido",
        message: `DBSCAN marco ${(noisePct * 100).toFixed(1)}% de los puntos como ruido. Prueba subir Eps o bajar MinPts.`,
      };
    }

    return {
      tone: "text-emerald-700 bg-emerald-50 border-emerald-100",
      title: "Agrupamiento visualmente util",
      message: "Los clusters tienen una distribucion razonable para inspeccion visual. Revisa tambien si sus variables originales tienen diferencias interpretables.",
    };
  })();

  const clusterProfiles = useMemo(() => {
    if (!clusterResult || !currentResult || numericSelected.length === 0) return [];
    const resultIds = new Set(currentResult.coordinates.map((coord) => String(coord.record_id)));
    const rowsInProjection = rows.filter((row) => resultIds.has(String(row["record_id"])));
    const globalStats = numericSelected.reduce<Record<string, { mean: number; std: number }>>((acc, col) => {
      const values = rowsInProjection
        .map((row) => parseFloat(String(row[col] ?? "")))
        .filter((value) => isFinite(value));
      const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      const variance = values.length ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length : 0;
      acc[col] = { mean, std: Math.sqrt(variance) || 1 };
      return acc;
    }, {});

    return clusterResult.clusters
      .filter((cluster) => cluster.label !== -1)
      .map((cluster) => {
        const members = rowsInProjection.filter(
          (row) => clusterResult.labels[String(row["record_id"])] === cluster.label
        );
        const variables = numericSelected
          .map((col) => {
            const values = members
              .map((row) => parseFloat(String(row[col] ?? "")))
              .filter((value) => isFinite(value));
            const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
            const global = globalStats[col];
            const zDiff = isFinite(mean) && global ? (mean - global.mean) / global.std : NaN;
            return { col, mean, globalMean: global?.mean ?? NaN, zDiff };
          })
          .filter((item) => isFinite(item.zDiff))
          .sort((a, b) => Math.abs(b.zDiff) - Math.abs(a.zDiff))
          .slice(0, 5);

        return { cluster, variables };
      });
  }, [clusterResult, currentResult, numericSelected, rows]);

  const getCoordinateRows = () => {
    return (currentResult?.coordinates ?? [])
      .map((coord) => ({
        id: String(coord.record_id),
        x: coord.x,
        y: coord.y,
        row: rowById.get(String(coord.record_id)),
      }))
      .filter((item) => item.row);
  };

  const selectNearestPair = () => {
    const items = getCoordinateRows();
    let best: { a: string; b: string; d: number } | null = null;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const d = Math.hypot(items[i].x - items[j].x, items[i].y - items[j].y);
        if (d > 1e-8 && (!best || d < best.d)) best = { a: items[i].id, b: items[j].id, d };
      }
    }
    if (best) {
      setSelectedIds([best.a, best.b]);
      setCaseNote(`Caso 1 automatico: par mas cercano en ${method.toUpperCase()} (distancia ${best.d.toFixed(4)}).`);
    }
  };

  const selectFarthestPair = () => {
    const items = getCoordinateRows();
    let best: { a: string; b: string; d: number } | null = null;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const d = Math.hypot(items[i].x - items[j].x, items[i].y - items[j].y);
        if (!best || d > best.d) best = { a: items[i].id, b: items[j].id, d };
      }
    }
    if (best) {
      setSelectedIds([best.a, best.b]);
      setCaseNote(`Caso 2 automatico: par mas lejano en ${method.toUpperCase()} (distancia ${best.d.toFixed(4)}).`);
    }
  };

  const selectOutlier = () => {
    const items = getCoordinateRows();
    if (!items.length) return;
    const mx = items.reduce((sum, item) => sum + item.x, 0) / items.length;
    const my = items.reduce((sum, item) => sum + item.y, 0) / items.length;
    const outlier = items
      .map((item) => ({ ...item, d: Math.hypot(item.x - mx, item.y - my) }))
      .sort((a, b) => b.d - a.d)[0];
    setSelectedIds([outlier.id]);
    setCaseNote(`Caso 3 automatico: punto mas alejado del centro de la proyeccion (distancia ${outlier.d.toFixed(4)}).`);
  };

  const selectCluster = () => {
    const items = getCoordinateRows();
    if (items.length < 20) return;
    const k = 4;
    let centers = [0.1, 0.35, 0.65, 0.9].map((q) => {
      const sorted = [...items].sort((a, b) => a.x - b.x);
      return { x: sorted[Math.floor((sorted.length - 1) * q)].x, y: sorted[Math.floor((sorted.length - 1) * q)].y };
    });
    let labels = new Array(items.length).fill(0);
    for (let iter = 0; iter < 40; iter++) {
      labels = items.map((item) => {
        let best = 0;
        let bestD = Infinity;
        centers.forEach((center, idx) => {
          const d = (item.x - center.x) ** 2 + (item.y - center.y) ** 2;
          if (d < bestD) { bestD = d; best = idx; }
        });
        return best;
      });
      centers = centers.map((center, idx) => {
        const members = items.filter((_, itemIdx) => labels[itemIdx] === idx);
        if (!members.length) return center;
        return {
          x: members.reduce((sum, item) => sum + item.x, 0) / members.length,
          y: members.reduce((sum, item) => sum + item.y, 0) / members.length,
        };
      });
    }
    const clusters = centers.map((center, idx) => {
      const members = items.filter((_, itemIdx) => labels[itemIdx] === idx);
      const compactness = members.length
        ? members.reduce((sum, item) => sum + Math.hypot(item.x - center.x, item.y - center.y), 0) / members.length
        : Infinity;
      return { idx, members, compactness };
    });
    const chosen = clusters
      .filter((cluster) => cluster.members.length >= 20)
      .sort((a, b) => b.members.length / Math.max(b.compactness, 0.001) - a.members.length / Math.max(a.compactness, 0.001))[0];
    if (!chosen) return;
    setSelectedIds(chosen.members.map((item) => item.id));
    setCaseNote(`Caso 4 automatico: cluster compacto con ${chosen.members.length} participantes.`);
  };

  // Construir datos del scatter con tipos correctos para Plotly
  const plotTrace = (() => {
    if (!currentResult) return null;
    const coords = currentResult.coordinates;

    const xVals: number[] = [];
    const yVals: number[] = [];
    const colorVals: number[] = [];
    const tooltips: string[] = [];
    const customIds: string[] = [];

    for (const c of coords) {
      const row = rowById.get(String(c.record_id));
      const colorV = row ? parseFloat(String(row[colorVar] ?? "")) : NaN;
      colorVals.push(isFinite(colorV) ? colorV : 0);
      xVals.push(c.x);
      yVals.push(c.y);
      customIds.push(String(c.record_id));
      if (row) {
        const lines = [`<b>ID: ${row["record_id"]}</b>`];
        const clusterLabel = clusterResult?.labels[String(c.record_id)];
        if (clusterLabel !== undefined) lines.push(`cluster: ${clusterLabel === -1 ? "ruido" : clusterLabel + 1}`);
        ["age","gender","gdt_total","promis_total","wemwbs_total","telem_nocturnal_sessions"].forEach((k) => {
          if (row[k] !== null && row[k] !== undefined && row[k] !== "") lines.push(`${k}: ${row[k]}`);
        });
        tooltips.push(lines.join("<br>"));
      } else {
        tooltips.push(`ID: ${c.record_id}`);
      }
    }

    return {
      type: "scatter" as const,
      mode: "markers" as const,
      x: xVals,
      y: yVals,
      marker: {
        size: method === "pca" ? 5 : 6,
        opacity: method === "pca" ? 0.6 : 0.75,
        color: colorVals,
        colorscale: "Viridis" as const,
        showscale: true,
        colorbar: { title: { text: colorVar, font: { size: 10 } }, thickness: 12, len: 0.7 },
      },
      text: tooltips,
      hovertemplate: "%{text}<extra></extra>",
      customdata: customIds,
    };
  })();

  const selectedTrace = (() => {
    if (!currentResult || selectedIds.length === 0) return null;
    const selectedCoords = selectedIds
      .map((id) => ({ id, coord: coordById.get(id) }))
      .filter((x): x is { id: string; coord: { x: number; y: number } } => Boolean(x.coord));
    if (!selectedCoords.length) return null;
    return {
      type: "scatter" as const,
      mode: "text+markers" as const,
      x: selectedCoords.map((x) => x.coord.x),
      y: selectedCoords.map((x) => x.coord.y),
      text: selectedCoords.map((x, i) => `${i + 1}: ${x.id}`),
      textposition: "top center" as const,
      hovertemplate: "Seleccionado: %{text}<extra></extra>",
      marker: {
        size: 13,
        color: "rgba(239,68,68,0.95)",
        line: { color: "white", width: 2 },
        symbol: "circle-open",
      },
      name: "Seleccionados",
    };
  })();

  const clusterTraces = (() => {
    if (!currentResult || !clusterResult) return null;
    return clusterResult.clusters.map((cluster) => {
      const coords = currentResult.coordinates.filter(
        (coord) => clusterResult.labels[String(coord.record_id)] === cluster.label
      );
      const isNoise = cluster.label === -1;
      const labelText = isNoise ? "Ruido" : `Cluster ${cluster.label + 1}`;
      return {
        type: "scatter" as const,
        mode: "markers" as const,
        x: coords.map((coord) => coord.x),
        y: coords.map((coord) => coord.y),
        customdata: coords.map((coord) => String(coord.record_id)),
        text: coords.map((coord) => {
          const row = rowById.get(String(coord.record_id));
          const lines = [`<b>ID: ${coord.record_id}</b>`, `grupo: ${labelText}`];
          if (row) {
            ["age","gender","gdt_total","promis_total","wemwbs_total","telem_nocturnal_sessions"].forEach((k) => {
              if (row[k] !== null && row[k] !== undefined && row[k] !== "") lines.push(`${k}: ${row[k]}`);
            });
          }
          return lines.join("<br>");
        }),
        hovertemplate: "%{text}<extra></extra>",
        name: `${labelText} (${coords.length})`,
        marker: {
          size: isNoise ? 5 : 6,
          opacity: isNoise ? 0.35 : 0.75,
          color: isNoise ? "#9ca3af" : CLUSTER_COLORS[cluster.label % CLUSTER_COLORS.length],
          line: { width: 0 },
        },
      };
    });
  })();

  const plotTraces = (() => {
    if (!plotTrace) return [];
    const x = plotTrace.x as number[];
    const y = plotTrace.y as number[];

    const mainTraces = clusterTraces ?? [plotTrace];

    if (method !== "pca" || x.length < 20) return selectedTrace ? [...mainTraces, selectedTrace] : mainTraces;

    const densityTrace = {
      type: "histogram2d",
      x,
      y,
      nbinsx: 36,
      nbinsy: 36,
      colorscale: [
        [0, "rgba(255,255,255,0)"],
        [0.25, "rgba(254,215,170,0.28)"],
        [0.55, "rgba(251,146,60,0.36)"],
        [1, "rgba(194,65,12,0.48)"],
      ],
      showscale: false,
      hoverinfo: "skip",
      name: "Densidad",
    } as unknown as import("plotly.js").Data;

    return selectedTrace ? [densityTrace, ...mainTraces, selectedTrace] : [densityTrace, ...mainTraces];
  })();

  const handleExport = () => {
    if (!currentResult) return;
    const merged = rows.map((r) => {
      const coord = currentResult.coordinates.find((c) => String(c.record_id) === String(r["record_id"]));
      const clusterLabel = clusterResult?.labels[String(r["record_id"])];
      return {
        ...r,
        [`${method}_x`]: coord?.x ?? null,
        [`${method}_y`]: coord?.y ?? null,
        cluster_label: clusterLabel ?? null,
        cluster_method: clusterResult?.method ?? null,
      };
    });
    downloadCSV(rowsToCSV(merged), `openplay_${method}_processed.csv`);
  };

  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Activity size={15} className="text-orange-500" /> Reducción dimensional
        </h2>
        {numericSelected.length < 2 && (
          <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 flex items-center gap-1">
            <AlertTriangle size={12} /> Selecciona al menos 2 variables numéricas en el vector de características.
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Selector de método */}
        <div className="flex gap-1">
          {(["pca","umap","tsne"] as Method[]).map((m) => (
            <button key={m} onClick={() => { setMethod(m); setClusterResult(null); setClusterError(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded border transition-colors ${method === m ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-600 hover:border-orange-300"}`}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Parámetros */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-gray-500">Imputación</label>
            <select value={impute} onChange={(e) => setImpute(e.target.value as ImputeMethod)}
              className="w-full border border-gray-200 rounded px-2 py-1 mt-0.5">
              <option value="mean">Media de columna</option>
              <option value="zero">Cero</option>
              <option value="drop">Eliminar fila</option>
            </select>
          </div>
          <div>
            <label className="text-gray-500">Variable de color</label>
            <select value={colorVar} onChange={(e) => setColorVar(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1 mt-0.5">
              {COLOR_VARS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {method === "umap" && (<>
            <div>
              <label className="text-gray-500">nNeighbors</label>
              <input type="number" value={nNeighbors} min={2} max={200}
                onChange={(e) => setNNeighbors(Number(e.target.value))}
                className="w-full border border-gray-200 rounded px-2 py-1 mt-0.5" />
            </div>
            <div>
              <label className="text-gray-500">minDist</label>
              <input type="number" value={minDist} min={0} max={1} step={0.05}
                onChange={(e) => setMinDist(Number(e.target.value))}
                className="w-full border border-gray-200 rounded px-2 py-1 mt-0.5" />
            </div>
            <div>
              <label className="text-gray-500">spread</label>
              <input type="number" value={spread} min={0.1} max={5} step={0.1}
                onChange={(e) => setSpread(Number(e.target.value))}
                className="w-full border border-gray-200 rounded px-2 py-1 mt-0.5" />
            </div>
          </>)}

          {method === "tsne" && (<>
            <div>
              <label className="text-gray-500">Perplexidad</label>
              <input type="number" value={perplexity} min={5} max={100}
                onChange={(e) => setPerplexity(Number(e.target.value))}
                className="w-full border border-gray-200 rounded px-2 py-1 mt-0.5" />
            </div>
            <div>
              <label className="text-gray-500">Iteraciones</label>
              <input type="number" value={iterations} min={100} max={2000} step={100}
                onChange={(e) => setIterations(Number(e.target.value))}
                className="w-full border border-gray-200 rounded px-2 py-1 mt-0.5" />
            </div>
            <div>
              <label className="text-gray-500">Learning rate</label>
              <input type="number" value={learningRate} min={10} max={1000}
                onChange={(e) => setLearningRate(Number(e.target.value))}
                className="w-full border border-gray-200 rounded px-2 py-1 mt-0.5" />
            </div>
          </>)}
        </div>

        {/* Info */}
        <div className="text-xs text-gray-400">
          {numericSelected.length} variables numéricas · {filteredRows.length.toLocaleString("es")} participantes
          {method === "tsne" && filteredRows.length > 500 && (
            <span className="text-yellow-600 ml-2">⚠️ t-SNE puede tardar varios minutos con {filteredRows.length} registros.</span>
          )}
        </div>

        {/* Botón ejecutar */}
        <button onClick={run} disabled={running || numericSelected.length < 2}
          className="w-full py-2 text-sm font-medium bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed">
          {running ? `Calculando ${method.toUpperCase()}… ${progress}%` : `Ejecutar ${method.toUpperCase()}`}
        </button>

        {running && (
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</div>
        )}

        {/* PCA info */}
        {pcaVarianceSummary && (
          <div className="text-xs bg-blue-50 border border-blue-100 rounded p-3 space-y-3">
            <div>
              <div className="font-medium text-blue-700 mb-1">Varianza explicada del PCA</div>
              <div className="overflow-x-auto border border-blue-100 rounded bg-white">
                <table className="w-full">
                  <thead className="bg-blue-50 text-blue-700">
                    <tr>
                      <th className="text-left px-2 py-1 font-medium">Componente</th>
                      <th className="text-right px-2 py-1 font-medium">Varianza</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-blue-50">
                      <td className="px-2 py-1 text-gray-700">CP1</td>
                      <td className="px-2 py-1 text-right font-mono font-semibold">{pcaVarianceSummary.pct(pcaVarianceSummary.pc1)}</td>
                    </tr>
                    <tr className="border-t border-blue-50">
                      <td className="px-2 py-1 text-gray-700">CP2</td>
                      <td className="px-2 py-1 text-right font-mono font-semibold">{pcaVarianceSummary.pct(pcaVarianceSummary.pc2)}</td>
                    </tr>
                    <tr className="border-t border-blue-100 bg-blue-50/60">
                      <td className="px-2 py-1 text-blue-800 font-medium">CP1 + CP2</td>
                      <td className="px-2 py-1 text-right font-mono font-bold text-blue-800">{pcaVarianceSummary.pct(pcaVarianceSummary.cumulative)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`border rounded px-3 py-2 ${pcaVarianceSummary.tone}`}>
              <div className="font-semibold">Conservacion {pcaVarianceSummary.level}: {pcaVarianceSummary.pct(pcaVarianceSummary.cumulative)} de la variabilidad total.</div>
              <div className="mt-1">{pcaVarianceSummary.message}</div>
              <div className="mt-1 text-gray-600">
                Importante: un porcentaje alto mejora la representacion visual, pero la calidad del analisis tambien depende de la interpretabilidad, los grupos observados y su relacion con las variables del estudio.
              </div>
            </div>

            {currentResult?.metadata.loadings && (
              <div>
                <div className="font-medium text-blue-700 mb-1">Loadings PC1 (top 5)</div>
                {numericSelected
                  .map((v, i) => ({ v, l: Math.abs(currentResult.metadata.loadings!["PC1"][i] ?? 0) }))
                  .sort((a, b) => b.l - a.l)
                  .slice(0, 5)
                  .map(({ v, l }) => (
                    <div key={v} className="flex justify-between">
                      <span className="text-gray-600 truncate">{v}</span>
                      <span className="font-mono">{l.toFixed(3)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Metadata */}
        {currentResult && (
          <div className="text-xs text-gray-500 flex justify-between items-center gap-3">
            <span>Usadas: <b>{currentResult.metadata.rowsUsed}</b> · Excluidas: <b>{currentResult.metadata.rowsExcluded}</b></span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addManualId(); }}
                  placeholder="record_id"
                  className="w-24 border border-gray-200 rounded px-2 py-1 text-xs"
                />
                <button onClick={addManualId} className="px-2 py-1 border border-gray-200 rounded text-gray-600 hover:border-orange-300">
                  Seleccionar
                </button>
              </div>
              <button onClick={handleExport} className="flex items-center gap-1 text-orange-600 hover:text-orange-700">
                <Download size={11} /> CSV con coordenadas
              </button>
            </div>
          </div>
        )}

        {currentResult && (
          <div className="border border-gray-100 rounded p-3 space-y-3">
            <div>
              <div className="text-sm font-semibold text-gray-700">Clustering sobre el espacio 2D</div>
              <p className="text-xs text-gray-400 mt-0.5">
                Agrupa las coordenadas actuales de {method.toUpperCase()} y colorea los puntos por grupo. Usa K-means para perfiles comparables y DBSCAN para detectar densidad/ruido.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="text-gray-500">Algoritmo</label>
                <select
                  value={clusteringMethod}
                  onChange={(e) => setClusteringMethod(e.target.value as ClusteringMethod)}
                  className="w-full border border-gray-200 rounded px-2 py-1 mt-0.5"
                >
                  <option value="kmeans">K-means (perfiles)</option>
                  <option value="hierarchical-single">Jerarquico single-link (outliers)</option>
                  <option value="dbscan">DBSCAN</option>
                </select>
              </div>

              {clusteringMethod === "kmeans" || clusteringMethod === "hierarchical-single" ? (
                <div>
                  <label className="text-gray-500">Numero de clusters</label>
                  <input
                    type="number"
                    value={clusterCount}
                    min={2}
                    max={20}
                    onChange={(e) => setClusterCount(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded px-2 py-1 mt-0.5"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-gray-500">Eps / radio</label>
                    <input
                      type="number"
                      value={dbscanEps}
                      min={0.01}
                      step={0.05}
                      onChange={(e) => setDbscanEps(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded px-2 py-1 mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500">MinPts</label>
                    <input
                      type="number"
                      value={dbscanMinPts}
                      min={2}
                      max={100}
                      onChange={(e) => setDbscanMinPts(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded px-2 py-1 mt-0.5"
                    />
                  </div>
                </>
              )}

              <div className="flex items-end gap-2">
                <button
                  onClick={runClustering}
                  className="flex-1 py-1.5 text-xs font-medium bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  Agrupar y colorear
                </button>
                {clusterResult && (
                  <button
                    onClick={() => setClusterResult(null)}
                    className="px-2 py-1.5 text-xs border border-gray-200 rounded text-gray-600 hover:border-orange-300"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {clusterError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{clusterError}</div>
            )}

            {clusterResult && (
              <div className="space-y-2">
                <div className="text-xs bg-blue-50 border border-blue-100 rounded px-2 py-1 text-blue-700">
                  Metodo: <b>{clusterResult.method === "kmeans" ? "K-means" : clusterResult.method === "hierarchical-single" ? "Jerarquico aglomerativo single-link" : "DBSCAN"}</b>
                  {" "}· Grupos detectados: <b>{clusterResult.clusters.filter((c) => c.label !== -1).length}</b>
                  {clusterResult.noiseCount > 0 && <> · Ruido: <b>{clusterResult.noiseCount}</b></>}
                </div>
                {clusterEvaluation && (
                  <div className={`text-xs border rounded px-2 py-1 ${clusterEvaluation.tone}`}>
                    <b>{clusterEvaluation.title}:</b> {clusterEvaluation.message}
                  </div>
                )}
                <div className="overflow-x-auto border border-gray-100 rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-2 py-1 font-medium">Grupo</th>
                        <th className="text-right px-2 py-1 font-medium">Participantes</th>
                        <th className="text-right px-2 py-1 font-medium">Centro X</th>
                        <th className="text-right px-2 py-1 font-medium">Centro Y</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clusterResult.clusters.slice(0, 20).map((cluster) => (
                        <tr key={cluster.label} className="border-t border-gray-50">
                          <td className="px-2 py-1">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full mr-1"
                              style={{ backgroundColor: cluster.label === -1 ? "#9ca3af" : CLUSTER_COLORS[cluster.label % CLUSTER_COLORS.length] }}
                            />
                            {cluster.label === -1 ? "Ruido" : `Cluster ${cluster.label + 1}`}
                          </td>
                          <td className="px-2 py-1 text-right font-mono">{cluster.count}</td>
                          <td className="px-2 py-1 text-right font-mono">{fmtNum(cluster.centroidX)}</td>
                          <td className="px-2 py-1 text-right font-mono">{fmtNum(cluster.centroidY)}</td>
                        </tr>
                      ))}
                      {clusterResult.clusters.length > 20 && (
                        <tr className="border-t border-gray-50">
                          <td colSpan={4} className="px-2 py-1 text-gray-400">
                            Mostrando los 20 grupos mas grandes de {clusterResult.clusters.length}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {clusterProfiles.length > 0 && (
                  <div className="border border-gray-100 rounded overflow-hidden">
                    <div className="px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-50">
                      Interpretacion por variables originales
                    </div>
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left px-2 py-1 font-medium">Grupo</th>
                          <th className="text-left px-2 py-1 font-medium">Variables que mas lo diferencian</th>
                          <th className="text-left px-2 py-1 font-medium">Lectura rapida</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clusterProfiles.map(({ cluster, variables }) => {
                          const strongest = variables[0];
                          const direction = strongest?.zDiff >= 0 ? "alto" : "bajo";
                          return (
                            <tr key={`profile-${cluster.label}`} className="border-t border-gray-50 align-top">
                              <td className="px-2 py-1 whitespace-nowrap">
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full mr-1"
                                  style={{ backgroundColor: CLUSTER_COLORS[cluster.label % CLUSTER_COLORS.length] }}
                                />
                                Cluster {cluster.label + 1}
                                <span className="text-gray-400 ml-1">({cluster.count})</span>
                              </td>
                              <td className="px-2 py-1">
                                <div className="flex flex-wrap gap-1">
                                  {variables.map((item) => (
                                    <span
                                      key={`${cluster.label}-${item.col}`}
                                      className={`rounded border px-1.5 py-0.5 ${
                                        item.zDiff >= 0
                                          ? "bg-blue-50 text-blue-700 border-blue-100"
                                          : "bg-orange-50 text-orange-700 border-orange-100"
                                      }`}
                                      title={`Media cluster: ${fmtNum(item.mean)} · Media global: ${fmtNum(item.globalMean)}`}
                                    >
                                      {item.col}: {item.zDiff >= 0 ? "+" : ""}{item.zDiff.toFixed(2)}σ
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-2 py-1 text-gray-600">
                                {strongest
                                  ? `Se diferencia sobre todo por ${strongest.col} ${direction} respecto al promedio.`
                                  : "No hay suficientes variables numericas para interpretar este grupo."}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="px-2 py-1 text-xs text-gray-500 border-t border-gray-100">
                      σ indica cuantas desviaciones estandar se aleja la media del cluster de la media global. Valores positivos son mas altos que el promedio; negativos, mas bajos.
                    </div>
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  Lectura: si un grupo contiene casi todos los puntos y los demas tienen 1 o 2 casos, no son perfiles; son atipicos. Para defender perfiles, busca grupos con tamanos razonables y diferencias interpretables en variables originales.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gráfico */}
        {plotTrace && (
          <div className="border border-gray-100 rounded overflow-hidden">
            <Plot
              data={plotTraces}
              layout={{
                height: 480,
                margin: { t: 20, r: 20, b: 50, l: 50 },
                paper_bgcolor: "white",
                plot_bgcolor: "#fafafa",
                xaxis: { title: { text: `${method.toUpperCase()} 1`, font: { size: 10 } }, zeroline: false },
                yaxis: {
                  title: { text: `${method.toUpperCase()} 2`, font: { size: 10 } },
                  zeroline: false,
                  scaleanchor: method === "pca" ? "x" : undefined,
                  scaleratio: method === "pca" ? 1 : undefined,
                },
                dragmode: "lasso",
                font: { size: 10 },
              }}
              config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ["toImage"] }}
              style={{ width: "100%" }}
              onClick={(data) => {
                const ridStr = data.points[0]?.customdata as string | undefined;
                if (ridStr !== undefined) {
                  toggleSelectedId(ridStr);
                  const row = rowById.get(ridStr);
                  if (row) setSelectedParticipant(row);
                }
              }}
              onSelected={(event?: { points?: { customdata?: unknown }[] }) => {
                const ids = (event?.points ?? [])
                  .map((p) => String(p.customdata ?? ""))
                  .filter((id) => id && coordById.has(id));
                if (ids.length) setSelectedIds(Array.from(new Set(ids)).slice(0, 30));
              }}
            />
          </div>
        )}

        {currentResult && (
          <div className="border border-gray-100 rounded p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <MousePointer2 size={14} className="text-orange-500" /> Seleccion coordinada
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Haz click para agregar o quitar puntos. Tambien puedes usar el lazo o escribir un record_id.
                </p>
              </div>
              {selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={() => setSelectedRecordIds(selectedIds)}
                    className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
                  >
                    Usar como filtro global
                  </button>
                  <button
                    onClick={clearSelectedRecordIds}
                    className="px-2 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:border-orange-300"
                  >
                    Quitar filtro global
                  </button>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:border-orange-300"
                  >
                    <X size={12} /> Limpiar
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button onClick={selectNearestPair} className="px-2 py-1.5 text-xs rounded border border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50">
                Caso 1: cercanos
              </button>
              <button onClick={selectFarthestPair} className="px-2 py-1.5 text-xs rounded border border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50">
                Caso 2: lejanos
              </button>
              <button onClick={selectOutlier} className="px-2 py-1.5 text-xs rounded border border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50">
                Caso 3: atipico
              </button>
              <button onClick={selectCluster} className="px-2 py-1.5 text-xs rounded border border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50">
                Caso 4: cluster
              </button>
            </div>

            {caseNote && (
              <div className="text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded px-2 py-1">
                {caseNote}
              </div>
            )}

            {selectedIds.length === 0 ? (
              <div className="text-xs text-gray-400 border border-dashed border-gray-200 rounded p-3">
                Selecciona dos puntos para calcular distancia euclidiana, o un conjunto de puntos para analizar un cluster.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selectedIds.slice(0, 60).map((id) => (
                  <button
                    key={id}
                    onClick={() => toggleSelectedId(id)}
                    className="px-2 py-1 text-xs rounded bg-red-50 text-red-700 border border-red-100 font-mono"
                  >
                    {id}
                  </button>
                ))}
                {selectedIds.length > 60 && (
                  <span className="px-2 py-1 text-xs rounded bg-gray-50 text-gray-500 border border-gray-100">
                    +{selectedIds.length - 60} mas
                  </span>
                )}
              </div>
            )}

            {pairSummary && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Punto A</div>
                    <div className="font-mono font-semibold text-gray-800">{pairSummary.aId}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Punto B</div>
                    <div className="font-mono font-semibold text-gray-800">{pairSummary.bId}</div>
                  </div>
                  <div className="bg-orange-50 rounded p-2">
                    <div className="text-orange-700">Distancia euclidiana ({method.toUpperCase()})</div>
                    <div className="font-mono font-semibold text-orange-800">{pairSummary.distance.toFixed(4)}</div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-gray-100 rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-2 py-1 font-medium">Variable</th>
                        <th className="text-right px-2 py-1 font-medium">A original</th>
                        <th className="text-right px-2 py-1 font-medium">B original</th>
                        <th className="text-right px-2 py-1 font-medium">Dif.</th>
                        <th className="text-right px-2 py-1 font-medium">Dif. %</th>
                        <th className="text-right px-2 py-1 font-medium">A std</th>
                        <th className="text-right px-2 py-1 font-medium">B std</th>
                        <th className="text-right px-2 py-1 font-medium">Dif. std</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pairSummary.variables.map((v) => (
                        <tr key={v.col} className="border-t border-gray-50">
                          <td className="px-2 py-1 text-gray-700">{v.col}</td>
                          <td className="px-2 py-1 text-right font-mono">{fmtNum(v.aVal)}</td>
                          <td className="px-2 py-1 text-right font-mono">{fmtNum(v.bVal)}</td>
                          <td className="px-2 py-1 text-right font-mono">{fmtNum(v.diff)}</td>
                          <td className="px-2 py-1 text-right font-mono">{isFinite(v.pct) ? `${v.pct.toFixed(1)}%` : "-"}</td>
                          <td className="px-2 py-1 text-right font-mono">{fmtNum(v.aStd)}</td>
                          <td className="px-2 py-1 text-right font-mono">{fmtNum(v.bStd)}</td>
                          <td className="px-2 py-1 text-right font-mono">{fmtNum(v.stdDiff)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {groupSummary && (
              <div className="overflow-x-auto border border-gray-100 rounded">
                <div className="px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-50">
                  Resumen del grupo seleccionado ({selectedRows.length} participantes)
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-2 py-1 font-medium">Variable</th>
                      <th className="text-right px-2 py-1 font-medium">Media grupo</th>
                      <th className="text-right px-2 py-1 font-medium">Media general</th>
                      <th className="text-right px-2 py-1 font-medium">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupSummary.map((v) => (
                      <tr key={v.col} className="border-t border-gray-50">
                        <td className="px-2 py-1 text-gray-700">{v.col}</td>
                        <td className="px-2 py-1 text-right font-mono">{fmtNum(v.groupMean)}</td>
                        <td className="px-2 py-1 text-right font-mono">{fmtNum(v.generalMean)}</td>
                        <td className="px-2 py-1 text-right font-mono">{fmtNum(v.diff)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedRows.length >= 2 && numericSelected.length >= 2 && (
              <div className="border border-gray-100 rounded overflow-hidden">
                <Plot
                  data={[{
                    type: "parcoords",
                    dimensions: numericSelected.slice(0, 10).map((col) => {
                      const values = selectedRows.map((r) => parseFloat(String(r[col] ?? "")));
                      const finite = values.filter((n) => isFinite(n));
                      return {
                        label: col,
                        values: values.map((n) => isFinite(n) ? n : null),
                        range: finite.length ? [Math.min(...finite), Math.max(...finite)] : [0, 1],
                      };
                    }),
                    line: {
                      color: selectedRows.map((_, i) => i),
                      colorscale: "Viridis",
                      showscale: false,
                    },
                  } as unknown as import("plotly.js").Data]}
                  layout={{
                    height: 280,
                    margin: { t: 20, r: 25, b: 25, l: 25 },
                    paper_bgcolor: "white",
                    font: { size: 10 },
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%" }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
