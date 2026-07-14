"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CheckCircle2, Layers, Moon, Network, ShieldCheck, X } from "lucide-react";
import { useStore, type DataRow } from "@/lib/store";
import { parseNumericValue } from "@/lib/data-utils";
import { RECOMMENDED_PROJECT_VECTOR } from "@/lib/openplay-vector";
import { summarizeAssignedClusters, type ClusterResult } from "@/lib/clustering-utils";
import { runProjectionInWorker } from "@/lib/analytics-worker-client";
import { analysisRunMatches } from "@/lib/openplay-analysis";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type ProjectionMethod = "pca" | "umap" | "tsne";

const FLAGS = [
  ["has_steam", "Steam"],
  ["has_xbox", "Xbox"],
  ["has_nintendo", "Nintendo"],
  ["has_android", "Android"],
  ["has_ios", "iOS"],
  ["has_cognitive", "Cognicion"],
  ["has_timeuse", "Uso tiempo"],
  ["has_daily", "Daily"],
  ["has_biweekly", "Biweekly"],
] as const;

const CLUSTER_COLORS = ["#4f647f", "#9b4d5f", "#5f725c", "#9b6f45"];
const WELLBEING_CASE_VARIABLES = ["promis_total", "wemwbs_total", "gdt_total", "bangs_total", "timeuse_gaming_entries", "timeuse_num_days"];

const CASES = [
  {
    title: "Caso 1: cobertura y confiabilidad",
    question: "Que fuentes tienen suficiente cobertura para sostener una interpretacion visual?",
    variables: "has_steam, has_xbox, has_nintendo, has_android, has_ios, has_cognitive, has_timeuse",
    icon: ShieldCheck,
    pattern:
      "La cobertura por fuente se calcula desde las banderas del dataset cargado. Las fuentes con poca cobertura se leen con cautela.",
    validation:
      "El grafico de barras se genera desde los datos actuales; al pasar el cursor se observa el porcentaje exacto de participantes con cada fuente.",
    knowledge: "La cobertura desigual puede producir separaciones por observabilidad; una fuente con pocos participantes no sostiene la misma fuerza de evidencia.",
    caution: "La cobertura no mide intensidad de juego. Android, iOS y Xbox deben analizarse como submuestras pequeñas.",
    transformation: "Media de cada bandera has_* multiplicada por 100.",
    output: "Barra horizontal: fuente en Y y porcentaje de cobertura en X.",
    confirmation: "Profiling de faltantes y filtros por disponibilidad.",
    tasks: "T1, T4",
    abstraction: "Descubrir · explorar · resumir y comparar · cobertura y distribuciones",
  },
  {
    title: "Caso 2: intensidad nocturna",
    question: "Existe un perfil asociado a mayor volumen de juego y mas sesiones nocturnas?",
    variables: "telem_nocturnal_sessions, telem_total_sessions, cluster calculado sobre vector estandarizado",
    icon: Moon,
    pattern:
      "Los puntos se colorean por perfil calculado desde el vector original, y la relacion se valida con sesiones totales vs. nocturnas.",
    validation:
      "Click abre el participante; seleccion con lazo/caja calcula un perfil agregado del grupo seleccionado.",
    knowledge: "La nocturnidad observada no aparece aislada: caracteriza un perfil de alta intensidad total que tambien registra actividad nocturna.",
    caution: "Es una asociacion descriptiva de telemetria; no demuestra efectos sobre sueño, ansiedad o bienestar.",
    transformation: "log(1 + valor) para reducir la influencia visual de extremos; color = cluster K-means.",
    output: "Dispersion: sesiones totales en X y nocturnas en Y.",
    confirmation: "Perfil estandarizado del cluster y variables originales.",
    tasks: "T2, T3, T4",
    abstraction: "Comprobar · localizar · comparar · relacion entre atributos",
  },
  {
    title: "Caso 3: bienestar, riesgo y uso registrado",
    question: "Hay un perfil donde bienestar, riesgo y uso del tiempo se diferencien al mismo tiempo?",
    variables: "promis_total, wemwbs_total, gdt_total, bangs_total, timeuse_gaming_entries, timeuse_num_days",
    icon: CheckCircle2,
    pattern:
      "El grafico compara medias estandarizadas por perfil para bienestar, riesgo y uso del tiempo.",
    validation:
      "La lectura no depende de una imagen estatica: las barras salen del clustering calculado al cargar el dataset.",
    knowledge: "Un mismo perfil combina mayor PROMIS y riesgo, menor WEMWBS y mas registros de uso del tiempo; la diferencia es multivariada.",
    caution: "Mas registros tambien implican mayor observabilidad. El perfil no constituye diagnostico ni demuestra causalidad.",
    transformation: "Imputacion por mediana, estandarizacion y media por cluster.",
    output: "Barras agrupadas: variable en X y diferencia estandarizada en Y.",
    confirmation: "Vista de encuestas y filtros has_biweekly/has_timeuse.",
    tasks: "T2, T3, T4",
    abstraction: "Comprobar · localizar · comparar · caracteristicas multivariadas",
  },
  {
    title: "Caso 4: perfil multiplataforma",
    question: "Que caracteriza a los participantes con mayor cobertura multiplataforma?",
    variables: "has_steam, has_xbox, has_nintendo, has_android, has_ios, has_cognitive, has_timeuse, has_daily, has_biweekly",
    icon: Network,
    pattern:
      "La cobertura por cluster permite diferenciar intensidad de juego frente a observabilidad multiplataforma.",
    validation:
      "El grafico agrupa fuentes por perfil y permite revisar porcentajes exactos con hover.",
    knowledge: "La separacion del perfil se explica en parte por mayor cobertura multiplataforma y no solamente por jugar mas.",
    caution: "La actividad registrada puede aumentar cuando existen mas plataformas observando al participante.",
    transformation: "Porcentaje medio de cada bandera de fuente dentro de cada cluster.",
    output: "Barras agrupadas: fuente en X, cobertura en Y y color por cluster.",
    confirmation: "num_platforms y num_telemetry_platforms en el perfil original.",
    tasks: "T1, T3, T4",
    abstraction: "Comprobar · localizar · comparar · cobertura y caracteristicas",
  },
];

function num(row: DataRow, col: string): number {
  return parseNumericValue(row[col]);
}

function mean(values: number[]): number {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : NaN;
}

function std(values: number[], center = mean(values)): number {
  const clean = values.filter(Number.isFinite);
  if (clean.length < 2 || !Number.isFinite(center)) return 0;
  const variance = clean.reduce((sum, value) => sum + (value - center) ** 2, 0) / clean.length;
  return Math.sqrt(variance);
}

export default function CaseStudiesValidation() {
  const {
    rows,
    columns,
    columnStats,
    selectedVariables,
    filteredRows,
    setSelectedParticipant,
    setSelectedRecordIds,
    clearSelectedRecordIds,
    selectedRecordIds,
    analysisRun,
    openBivariate,
    setActiveTab,
  } = useStore();
  const sourceRows = filteredRows.length ? filteredRows : rows;
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([]);
  const [vectorMode, setVectorMode] = useState<"recommended" | "selected">("recommended");
  const [projectionMethod, setProjectionMethod] = useState<ProjectionMethod>("pca");
  const [projection, setProjection] = useState<{
    method: ProjectionMethod;
    coordinates: { record_id: unknown; x: number; y: number }[];
    metadata: { rowsUsed: number; rowsExcluded: number; variablesUsed: string[]; explainedVariance?: number[] };
  } | null>(null);
  const [projectionClusters, setProjectionClusters] = useState<ClusterResult | null>(null);
  const [projectionProgress, setProjectionProgress] = useState(0);
  const [projectionRunning, setProjectionRunning] = useState(false);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [activeCase, setActiveCase] = useState(0);
  const [caseX, setCaseX] = useState("telem_total_sessions");
  const [caseY, setCaseY] = useState("telem_nocturnal_sessions");

  const recommendedAvailable = useMemo(
    () => RECOMMENDED_PROJECT_VECTOR.filter((col) => columns.includes(col) && columnStats[col]?.type === "numeric"),
    [columns, columnStats]
  );
  const selectedNumeric = useMemo(
    () => selectedVariables.filter((col) => columnStats[col]?.type === "numeric"),
    [selectedVariables, columnStats]
  );
  const availableNumeric = useMemo(
    () => Object.keys(columnStats).filter((column) => columnStats[column]?.type === "numeric"),
    [columnStats]
  );
  const effectiveFeatures = vectorMode === "selected" && selectedNumeric.length >= 2 ? selectedNumeric : recommendedAvailable;
  const effectiveModeLabel = vectorMode === "selected" && selectedNumeric.length >= 2
    ? "Vector seleccionado actualmente"
    : "Vector integral recomendado";

  const runIsCurrent = analysisRunMatches(analysisRun, sourceRows, effectiveFeatures);

  const officialRun = runIsCurrent ? analysisRun : null;
  const analysis = useMemo(() => {
    const rowsWithCluster = sourceRows.map((row, index) => {
      const id = String(row["record_id"] ?? row["pid"] ?? index);
      return { row, id, cluster: officialRun?.labels[id] ?? 0 };
    });
    const profileCols = officialRun?.clusters[0]?.profile.map((item) => item.column) ?? [];
    return {
      availableFeatures: officialRun?.config.features ?? effectiveFeatures,
      rowsWithCluster,
      clusterCounts: officialRun?.clusters.map((cluster) => cluster.count) ?? [sourceRows.length, 0, 0, 0],
      profileCols,
      profile: officialRun?.clusters.map((cluster) =>
        profileCols.map((column) => cluster.profile.find((item) => item.column === column)?.standardizedDifference ?? 0)
      ) ?? [profileCols.map(() => 0)],
    };
  }, [officialRun, sourceRows, effectiveFeatures]);
  const idToRow = useMemo(() => new Map(analysis.rowsWithCluster.map((item) => [item.id, item.row])), [analysis.rowsWithCluster]);

  const runOfficialProjection = async () => {
    if (effectiveFeatures.length < 2) {
      setProjectionError("Selecciona al menos 2 variables numericas para proyectar.");
      return;
    }
    setProjectionRunning(true);
    setProjectionProgress(0);
    setProjectionError(null);
    try {
      const params: Record<string, number> = projectionMethod === "umap"
        ? { nNeighbors: 15, minDist: 0.1, spread: 1 }
        : { perplexity: 30, iterations: 500, learningRate: 200 };
      const result = await runProjectionInWorker(
        projectionMethod, sourceRows, effectiveFeatures, "median", params, setProjectionProgress
      );

      const points = result.coordinates.map((coord) => ({
        record_id: coord.record_id,
        x: coord.x,
        y: coord.y,
      }));
      if (!officialRun) throw new Error("La ejecucion oficial aun se esta preparando.");
      const clusters = summarizeAssignedClusters(points, officialRun.labels, {
        clusters: 4,
        seed: officialRun.config.seed,
        space: "original-standardized",
      });
      setProjection({
        method: projectionMethod,
        coordinates: result.coordinates,
        metadata: result.metadata,
      });
      setProjectionClusters(clusters);
      setProjectionProgress(100);
    } catch (error) {
      setProjectionError(error instanceof Error ? error.message : String(error));
    } finally {
      setProjectionRunning(false);
    }
  };

  const coverage = FLAGS
    .filter(([col]) => sourceRows.some((row) => row[col] !== undefined))
    .map(([col, label]) => ({
      col,
      label,
      pct: sourceRows.length ? mean(sourceRows.map((row) => num(row, col) || 0)) * 100 : 0,
    }));

  const selectedRows = localSelectedIds.map((id) => idToRow.get(id)).filter(Boolean) as DataRow[];
  const selectedProfile = analysis.profileCols
    .map((col) => {
      const groupMean = mean(selectedRows.map((row) => num(row, col)));
      const globalMean = mean(sourceRows.map((row) => num(row, col)));
      const globalStd = std(sourceRows.map((row) => num(row, col)), globalMean) || 1;
      return { col, z: Number.isFinite(groupMean) ? (groupMean - globalMean) / globalStd : 0, groupMean, globalMean };
    })
    .filter((item) => Number.isFinite(item.z))
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .slice(0, 8);

  const selectIds = (ids: string[]) => {
    const unique = Array.from(new Set(ids)).slice(0, 200);
    setLocalSelectedIds(unique);
  };

  const openParticipant = (id: string) => {
    const row = idToRow.get(id);
    if (row) setSelectedParticipant(row);
  };

  const plotLayout = {
    margin: { t: 42, r: 20, b: 58, l: 62 },
    paper_bgcolor: "white",
    plot_bgcolor: "#f9fafb",
    font: { size: 10 },
    hovermode: "closest" as const,
  };
  const caseClusterLabel = [null, 2, 3, 0][activeCase];
  const caseCluster = caseClusterLabel === null ? null : officialRun?.clusters[caseClusterLabel] ?? null;
  const caseReason = activeCase === 0
    ? "Se eligio porque la diferencia entre fuentes condiciona la fuerza de toda interpretacion posterior."
    : caseCluster
      ? `Se eligio C${caseCluster.label} (${caseCluster.count} participantes) porque obtuvo el mayor puntaje para el perfil ${caseCluster.name.toLowerCase()}. Sus diferencias mas visibles incluyen ${caseCluster.topVariables.slice(0, 3).map((item) => `${item.column} (${item.standardizedDifference.toFixed(2)}σ)`).join(", ")}.`
      : "La ejecucion oficial se esta preparando.";

  if (!officialRun) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded p-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Layers size={15} className="text-orange-500" /> Estudios de caso y validación
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Validación resume y contrasta una ejecución existente; no genera perfiles automáticamente.
          </p>
        </div>
        <section className="bg-amber-50 border border-amber-200 rounded p-5">
          <h3 className="text-sm font-semibold text-amber-900">Falta generar la ejecución oficial</h3>
          <p className="text-xs text-amber-800 mt-2 max-w-3xl leading-relaxed">
            Primero selecciona el vector recomendado. Después abre PCA / t-SNE / UMAP, ejecuta PCA y pulsa
            Agrupar y colorear con K-means y 4 grupos. Solo entonces esta pestaña podrá validar los mismos perfiles.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={() => setActiveTab("vector")} className="px-3 py-1.5 text-xs rounded border border-amber-300 bg-white text-amber-900 hover:border-amber-500">
              1. Ir a Vector
            </button>
            <button onClick={() => setActiveTab("reduccion")} className="px-3 py-1.5 text-xs rounded bg-amber-700 text-white hover:bg-amber-800">
              2. Ir a PCA / t-SNE / UMAP
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded p-4">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Layers size={15} className="text-orange-500" /> Estudios de caso y validacion interactiva
        </h2>
        <p className="text-xs text-gray-500 mt-1 max-w-4xl">
          Estos graficos se calculan desde el dataset cargado en la aplicacion. Usa hover para ver valores,
          click para abrir participantes y seleccion con lazo o caja para analizar grupos.
        </p>
      </div>

      <section className="bg-white border border-gray-200 rounded p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div>
          <h3 className="text-sm font-semibold text-gray-800">Metodo usado para validar</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-4xl">
            Se usan {analysis.availableFeatures.length} variables numericas disponibles, imputacion por mediana,
            estandarizacion y K-means sobre el vector original. Los graficos son vistas interactivas de esos perfiles,
            no imagenes pegadas.
          </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setVectorMode("recommended")}
              className={`px-3 py-1.5 text-xs rounded border ${
                vectorMode === "recommended"
                  ? "bg-orange-500 text-white border-orange-500"
                  : "border-gray-200 text-gray-600 hover:border-orange-300"
              }`}
            >
              Vector recomendado
            </button>
            <button
              onClick={() => setVectorMode("selected")}
              disabled={selectedNumeric.length < 2}
              className={`px-3 py-1.5 text-xs rounded border ${
                vectorMode === "selected"
                  ? "bg-orange-500 text-white border-orange-500"
                  : "border-gray-200 text-gray-600 hover:border-orange-300 disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
            >
              Vector seleccionado ({selectedNumeric.length})
            </button>
          </div>
        </div>
        <div className="border border-orange-100 bg-orange-50 rounded p-3">
          <div className="text-xs font-semibold text-orange-800">{effectiveModeLabel}</div>
          <div className="text-[11px] text-orange-700 mt-1">
            Estas son las variables que entran al clustering y a los perfiles de validacion.
          </div>
          <div className="flex flex-wrap gap-1 mt-2 max-h-24 overflow-y-auto">
            {analysis.availableFeatures.map((col) => (
              <span key={col} className="text-[11px] bg-white border border-orange-200 text-orange-700 rounded px-2 py-0.5 font-mono">
                {col}
              </span>
            ))}
            {analysis.availableFeatures.length === 0 && (
              <span className="text-xs text-orange-700">No hay variables numericas suficientes disponibles.</span>
            )}
          </div>
        </div>
        {officialRun ? (
          <div className="border border-emerald-200 bg-emerald-50 rounded p-3 text-xs text-emerald-800">
            <div className="font-semibold">Ejecucion oficial compartida activa</div>
            <div className="mt-1">
              {officialRun.dataset.rows} participantes · {officialRun.config.features.length} variables · mediana · estandarizacion · K-means en espacio original · k=4 · semilla {officialRun.config.seed}.
            </div>
            <div className="mt-1">
              {officialRun.clusters.map((cluster) => `C${cluster.label} ${cluster.name}: ${cluster.count}`).join(" · ")}
            </div>
          </div>
        ) : (
          <div className="border border-yellow-200 bg-yellow-50 rounded p-3 text-xs text-yellow-800">
            Preparando la ejecucion oficial compartida...
          </div>
        )}
        <div className="border border-blue-100 bg-blue-50 rounded p-3 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-blue-800">Grafico igual al modulo PCA / t-SNE / UMAP</div>
              <div className="text-[11px] text-blue-700 mt-1">
                Usa el mismo vector, imputacion por mediana y las mismas etiquetas oficiales. PCA, UMAP o t-SNE solo cambian el mapa donde se muestran los perfiles.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["pca", "umap", "tsne"] as ProjectionMethod[]).map((method) => (
                <button
                  key={method}
                  onClick={() => setProjectionMethod(method)}
                  className={`px-3 py-1.5 text-xs rounded border ${
                    projectionMethod === method
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white border-blue-200 text-blue-700 hover:border-blue-400"
                  }`}
                >
                  {method.toUpperCase()}
                </button>
              ))}
              <button
                onClick={runOfficialProjection}
                disabled={projectionRunning || effectiveFeatures.length < 2 || !officialRun}
                className="px-3 py-1.5 text-xs rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {projectionRunning ? `Calculando ${projectionMethod.toUpperCase()} ${projectionProgress}%` : "Generar grafico oficial"}
              </button>
            </div>
          </div>
          {projectionError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1">{projectionError}</div>
          )}
          {projection && projectionClusters && (
            <div className="border border-blue-100 rounded overflow-hidden bg-white">
              <Plot
                data={projectionClusters.clusters.map((cluster) => {
                  const coords = projection.coordinates.filter(
                    (coord) => projectionClusters.labels[String(coord.record_id)] === cluster.label
                  );
                  return {
                    type: "scattergl",
                    mode: "markers",
                    name: `C${cluster.label} ${officialRun?.clusters[cluster.label]?.name ?? ""} (${cluster.count})`,
                    x: coords.map((coord) => coord.x),
                    y: coords.map((coord) => coord.y),
                    customdata: coords.map((coord) => String(coord.record_id)),
                    text: coords.map((coord) => {
                      const row = idToRow.get(String(coord.record_id));
                      return `ID: ${coord.record_id}<br>cluster: C${cluster.label}<br>gdt_total: ${row ? num(row, "gdt_total") : "-"}<br>promis_total: ${row ? num(row, "promis_total") : "-"}`;
                    }),
                    hovertemplate: "%{text}<extra></extra>",
                    marker: {
                      size: projection.method === "pca" ? 5 : 6,
                      opacity: projection.method === "pca" ? 0.6 : 0.75,
                      color: CLUSTER_COLORS[Math.max(0, cluster.label) % CLUSTER_COLORS.length],
                    },
                  };
                })}
                layout={{
                  ...plotLayout,
                  height: 430,
                  title: {
                    text:
                      projection.method === "pca" && projection.metadata.explainedVariance
                        ? `PCA oficial - CP1+CP2 ${((projection.metadata.explainedVariance[0] + projection.metadata.explainedVariance[1]) * 100).toFixed(1)}%`
                        : `${projection.method.toUpperCase()} con perfiles del espacio original`,
                    font: { size: 12 },
                  },
                  xaxis: { title: { text: `${projection.method.toUpperCase()} 1` }, zeroline: false },
                  yaxis: { title: { text: `${projection.method.toUpperCase()} 2` }, zeroline: false },
                  dragmode: "lasso",
                }}
                config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ["toImage"] }}
                style={{ width: "100%" }}
                onClick={(event) => {
                  const id = String(event.points?.[0]?.customdata ?? "");
                  if (id) openParticipant(id);
                }}
                onSelected={(event?: { points?: { customdata?: unknown }[] }) => {
                  const ids = (event?.points ?? []).map((point) => String(point.customdata ?? "")).filter(Boolean);
                  if (ids.length) selectIds(ids);
                }}
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          {[
            ["Vector", "Integra bienestar, riesgo, telemetria, cognicion, plataformas y uso del tiempo."],
            ["Preparacion", "Imputa faltantes por mediana y estandariza variables para comparar escalas."],
            ["Perfiles", "Calcula K-means sobre el vector estandarizado, no sobre una captura estatica."],
            ["Interaccion", "Click abre participante; seleccion de puntos genera un perfil agregado."],
          ].map(([title, description]) => (
            <div key={title} className="border border-gray-100 rounded p-3 bg-gray-50">
              <div className="text-xs font-semibold text-gray-700">{title}</div>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {localSelectedIds.length > 0 && (
        <section className="bg-white border border-orange-200 rounded p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Seleccion actual: {localSelectedIds.length} participantes</h3>
              <p className="text-xs text-gray-500">Perfil agregado calculado desde los puntos seleccionados.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedRecordIds(localSelectedIds)}
                className="px-2 py-1 text-xs rounded bg-orange-500 text-white hover:bg-orange-600"
              >
                Usar como filtro global
              </button>
              {selectedRecordIds.length > 0 && (
                <button
                  onClick={clearSelectedRecordIds}
                  className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:border-orange-300"
                >
                  Quitar filtro global
                </button>
              )}
              <button
                onClick={() => setLocalSelectedIds([])}
                className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:border-orange-300 flex items-center gap-1"
              >
                <X size={12} /> Limpiar
              </button>
            </div>
          </div>
          <Plot
            data={[
              {
                type: "bar",
                orientation: "h",
                x: selectedProfile.map((item) => item.z),
                y: selectedProfile.map((item) => item.col),
                marker: { color: selectedProfile.map((item) => (item.z >= 0 ? "#4f647f" : "#9b6f45")) },
                customdata: selectedProfile.map((item) => [item.groupMean, item.globalMean]),
                hovertemplate: "Dif. std: %{x:.2f}<br>Media seleccion: %{customdata[0]:.2f}<br>Media global: %{customdata[1]:.2f}<extra></extra>",
              },
            ]}
            layout={{ ...plotLayout, height: 300, title: { text: "Variables que distinguen la seleccion", font: { size: 12 } } }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        </section>
      )}

      <section className="bg-white border-2 border-orange-200 rounded p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Reproducir un grafico de validacion</h3>
          <p className="text-xs text-gray-500 mt-1">
            Selecciona un caso para ver exactamente que columnas entran, como se transforman y que grafico se genera.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
          {CASES.map((item, index) => (
            <button key={item.title} onClick={() => setActiveCase(index)} className={`text-left p-3 rounded border text-xs ${activeCase === index ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"}`}>
              <span className="font-semibold">Caso {index + 1}</span>
              <span className="block mt-1 opacity-90">{item.title.replace(/^Caso \d+: /, "")}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 text-xs">
          <ProvenanceStep number="1" title="Columnas de entrada" text={activeCase === 1 ? `${caseX}, ${caseY}, cluster` : CASES[activeCase].variables} mono />
          <ProvenanceStep number="2" title="Transformacion" text={CASES[activeCase].transformation} />
          <ProvenanceStep number="3" title="Grafico generado" text={CASES[activeCase].output} />
          <ProvenanceStep number="4" title="Vista que confirma" text={CASES[activeCase].confirmation} />
        </div>
        <div className="border border-violet-200 bg-violet-50 rounded p-3 text-xs text-violet-800">
          <div className="font-semibold">Por que se convirtio en caso de estudio</div>
          <div className="mt-1 leading-relaxed">{caseReason}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeCase === 1 && (
            <button onClick={() => openBivariate(caseX, caseY, "official_cluster")} className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">
              Abrir estas variables en Bivariado
            </button>
          )}
          {activeCase === 2 && (
            <button onClick={() => setActiveTab("encuestas")} className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">
              Abrir gráfico generado en Encuestas
            </button>
          )}
          {activeCase === 3 && (
            <button onClick={() => setActiveTab("datos")} className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">
              Abrir cobertura por perfil en Datos
            </button>
          )}
          <button onClick={() => setActiveTab("filtros")} className="px-3 py-1.5 text-xs rounded border border-gray-200 text-gray-700 hover:border-orange-300">
            Controlar con Filtros
          </button>
        </div>
        {activeCase === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-blue-100 bg-blue-50 rounded p-3">
            <VariableControl label="Variable del eje X" value={caseX} options={availableNumeric} onChange={setCaseX} />
            <VariableControl label="Variable del eje Y" value={caseY} options={availableNumeric} onChange={setCaseY} />
            <p className="md:col-span-2 text-[11px] text-blue-700">
              Formula visible: X = log(1 + {caseX}), Y = log(1 + {caseY}), color = cluster calculado desde el vector activo.
            </p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {activeCase === 0 && <ValidationCard item={CASES[0]}>
          <Plot
            data={[
              {
                type: "bar",
                orientation: "h",
                x: coverage.map((item) => item.pct),
                y: coverage.map((item) => item.label),
                marker: { color: "#4f647f" },
                customdata: coverage.map((item) => item.col),
                hovertemplate: "%{y}<br>Cobertura: %{x:.1f}%<br>Variable: %{customdata}<extra></extra>",
              },
            ]}
            layout={{
              ...plotLayout,
              height: 360,
              title: { text: "Cobertura por fuente calculada desde el dataset", font: { size: 12 } },
              xaxis: { title: { text: "Participantes con datos (%)" }, range: [0, 105] },
            }}
            config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ["toImage"] }}
            style={{ width: "100%" }}
          />
        </ValidationCard>}

        {activeCase === 1 && <ValidationCard item={CASES[1]}>
          <Plot
            data={Array.from({ length: 4 }, (_, cluster) => {
              const points = analysis.rowsWithCluster.filter((item) => item.cluster === cluster);
              return {
                type: "scattergl",
                mode: "markers",
                name: `C${cluster} (${points.length})`,
                x: points.map((item) => Math.log1p(Math.max(0, num(item.row, caseX) || 0))),
                y: points.map((item) => Math.log1p(Math.max(0, num(item.row, caseY) || 0))),
                customdata: points.map((item) => item.id),
                text: points.map((item) => {
                  const row = item.row;
                  return `ID: ${item.id}<br>Cluster: C${cluster}<br>${caseX}: ${num(row, caseX) || 0}<br>${caseY}: ${num(row, caseY) || 0}`;
                }),
                hovertemplate: "%{text}<extra></extra>",
                marker: { size: 6, opacity: 0.65, color: CLUSTER_COLORS[cluster] },
              };
            })}
            layout={{
              ...plotLayout,
              height: 380,
              title: { text: `${caseX} vs. ${caseY}`, font: { size: 12 } },
              xaxis: { title: { text: `log(1 + ${caseX})` } },
              yaxis: { title: { text: `log(1 + ${caseY})` } },
              dragmode: "lasso",
            }}
            config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ["toImage"] }}
            style={{ width: "100%" }}
            onClick={(event) => {
              const id = String(event.points?.[0]?.customdata ?? "");
              if (id) openParticipant(id);
            }}
            onSelected={(event?: { points?: { customdata?: unknown }[] }) => {
              const ids = (event?.points ?? []).map((point) => String(point.customdata ?? "")).filter(Boolean);
              if (ids.length) selectIds(ids);
            }}
          />
        </ValidationCard>}

        {activeCase === 2 && <ValidationCard item={CASES[2]}>
          <Plot
            data={analysis.profile.map((values, cluster) => {
              const selected = analysis.profileCols
                .map((column, index) => ({ column, value: values[index] }))
                .filter((item) => WELLBEING_CASE_VARIABLES.includes(item.column));
              return {
                type: "bar",
                name: `C${cluster} (${analysis.clusterCounts[cluster]})`,
                x: selected.map((item) => item.column),
                y: selected.map((item) => item.value),
                marker: { color: CLUSTER_COLORS[cluster] },
                hovertemplate: "Perfil %{fullData.name}<br>%{x}: %{y:.2f}σ<extra></extra>",
              };
            })}
            layout={{
              ...plotLayout,
              height: 380,
              title: { text: "Perfil estandarizado por cluster", font: { size: 12 } },
              yaxis: { title: { text: "Media estandarizada" }, zeroline: true },
              barmode: "group",
            }}
            config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ["toImage"] }}
            style={{ width: "100%" }}
          />
        </ValidationCard>}

        {activeCase === 3 && <ValidationCard item={CASES[3]}>
          <Plot
            data={Array.from({ length: 4 }, (_, cluster) => {
              const members = analysis.rowsWithCluster.filter((item) => item.cluster === cluster);
              return {
                type: "bar",
                name: `C${cluster} (${members.length})`,
                x: FLAGS.filter(([col]) => sourceRows.some((row) => row[col] !== undefined)).map(([, label]) => label),
                y: FLAGS.filter(([col]) => sourceRows.some((row) => row[col] !== undefined)).map(([col]) =>
                  members.length ? mean(members.map((item) => num(item.row, col) || 0)) * 100 : 0
                ),
                marker: { color: CLUSTER_COLORS[cluster] },
                hovertemplate: "Perfil %{fullData.name}<br>%{x}: %{y:.1f}%<extra></extra>",
              };
            })}
            layout={{
              ...plotLayout,
              height: 380,
              title: { text: "Cobertura de fuentes por perfil", font: { size: 12 } },
              yaxis: { title: { text: "Cobertura dentro del cluster (%)" }, range: [0, 105] },
              barmode: "group",
            }}
            config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ["toImage"] }}
            style={{ width: "100%" }}
          />
        </ValidationCard>}
      </div>
    </div>
  );
}

function ProvenanceStep({ number, title, text, mono = false }: { number: string; title: string; text: string; mono?: boolean }) {
  return <div className="border border-orange-100 bg-orange-50 rounded p-3">
    <div className="flex items-center gap-2 font-semibold text-orange-800">
      <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px]">{number}</span>
      {title}
    </div>
    <div className={`mt-2 text-orange-700 leading-relaxed ${mono ? "font-mono text-[11px]" : ""}`}>{text}</div>
  </div>;
}

function VariableControl({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="text-xs text-blue-800">
    <span className="block font-semibold mb-1">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-blue-200 bg-white rounded px-2 py-1.5 font-mono text-xs">
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>;
}

function ValidationCard({ item, children }: { item: (typeof CASES)[number]; children: React.ReactNode }) {
  const Icon = item.icon;
  return (
    <section className="bg-white border border-gray-200 rounded p-4 space-y-3 xl:col-span-2">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Icon size={16} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{item.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{item.question}</p>
          <div className="text-[11px] text-orange-700 bg-orange-50 border border-orange-100 inline-flex rounded px-1.5 py-0.5 mt-1">
            Tareas: {item.tasks}
          </div>
          <div className="text-[11px] text-violet-700 mt-1">
            Abstraccion Why: {item.abstraction}
          </div>
        </div>
      </div>

      <div className="border border-gray-100 rounded overflow-hidden bg-gray-50">{children}</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <div className="border border-gray-100 rounded p-2">
          <div className="font-semibold text-gray-600 mb-1">Variables</div>
          <div className="text-gray-500 font-mono leading-relaxed">{item.variables}</div>
        </div>
        <div className="border border-blue-100 bg-blue-50 rounded p-2">
          <div className="font-semibold text-blue-700 mb-1">Patron</div>
          <div className="text-blue-700 leading-relaxed">{item.pattern}</div>
        </div>
        <div className="border border-emerald-100 bg-emerald-50 rounded p-2">
          <div className="font-semibold text-emerald-700 mb-1">Validacion</div>
          <div className="text-emerald-700 leading-relaxed">{item.validation}</div>
        </div>
        <div className="border border-violet-100 bg-violet-50 rounded p-2">
          <div className="font-semibold text-violet-700 mb-1">Conocimiento obtenido</div>
          <div className="text-violet-700 leading-relaxed">{item.knowledge}</div>
        </div>
        <div className="border border-amber-100 bg-amber-50 rounded p-2">
          <div className="font-semibold text-amber-700 mb-1">Limite de la interpretacion</div>
          <div className="text-amber-700 leading-relaxed">{item.caution}</div>
        </div>
      </div>
    </section>
  );
}
