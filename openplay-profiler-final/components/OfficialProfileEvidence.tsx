"use client";

import dynamic from "next/dynamic";
import { Activity, BarChart3 } from "lucide-react";
import { useStore, type DataRow } from "@/lib/store";
import { parseNumericValue } from "@/lib/data-utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const CLUSTER_COLORS = ["#4f647f", "#9b4d5f", "#5f725c", "#9b6f45"];
const WELLBEING_VARIABLES = [
  "promis_total",
  "wemwbs_total",
  "gdt_total",
  "bangs_total",
  "timeuse_gaming_entries",
  "timeuse_num_days",
];
const FLAGS = [
  ["has_steam", "Steam"],
  ["has_xbox", "Xbox"],
  ["has_nintendo", "Nintendo"],
  ["has_android", "Android"],
  ["has_ios", "iOS"],
  ["has_cognitive", "Cognición"],
  ["has_timeuse", "Uso del tiempo"],
  ["has_daily", "Daily"],
  ["has_biweekly", "Biweekly"],
] as const;

function recordId(row: DataRow, index: number): string {
  return String(row.record_id ?? row.pid ?? index);
}

function numeric(row: DataRow, column: string): number {
  return parseNumericValue(row[column]);
}

function mean(values: number[]): number {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function MissingOfficialRun({ description }: { description: string }) {
  const setActiveTab = useStore((state) => state.setActiveTab);
  return (
    <section className="bg-white border border-amber-200 rounded p-4">
      <div className="flex items-start gap-3">
        <Activity size={17} className="text-amber-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-amber-800">Primero genera los perfiles</h3>
          <p className="text-xs text-amber-700 mt-1 max-w-3xl">{description}</p>
          <button
            onClick={() => setActiveTab("reduccion")}
            className="mt-3 px-3 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-700"
          >
            Ir a PCA / t-SNE / UMAP
          </button>
        </div>
      </div>
    </section>
  );
}

const baseLayout = {
  margin: { t: 45, r: 20, b: 75, l: 65 },
  paper_bgcolor: "white",
  plot_bgcolor: "#f9fafb",
  font: { size: 10 },
};

export function WellbeingRiskEvidence() {
  const analysisRun = useStore((state) => state.analysisRun);
  if (!analysisRun) {
    return (
      <MissingOfficialRun description="Selecciona el vector recomendado, ejecuta PCA y después K-means con 4 grupos. Al terminar, esta vista generará la comparación de bienestar, riesgo y uso registrado fuera de Validación." />
    );
  }

  const available = WELLBEING_VARIABLES.filter((column) =>
    analysisRun.clusters.some((cluster) => cluster.profile.some((item) => item.column === column))
  );

  return (
    <section className="bg-white border border-gray-200 rounded p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <BarChart3 size={15} className="text-orange-500" /> Caso 3 generado: bienestar, riesgo y uso registrado
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Esta comparación se genera desde la ejecución K-means ya realizada en PCA / t-SNE / UMAP; Validación no crea estos perfiles.
        </p>
      </div>
      <div className="border border-emerald-100 bg-emerald-50 rounded px-3 py-2 text-xs text-emerald-800">
        Ejecución activa: {analysisRun.dataset.rows} participantes · {analysisRun.config.features.length} variables · mediana · estandarización · K-means k=4.
      </div>
      <div className="border border-gray-100 rounded overflow-hidden">
        <Plot
          data={analysisRun.clusters.map((cluster) => ({
            type: "bar",
            name: `C${cluster.label} (${cluster.count})`,
            x: available,
            y: available.map(
              (column) => cluster.profile.find((item) => item.column === column)?.standardizedDifference ?? 0
            ),
            marker: { color: CLUSTER_COLORS[cluster.label % CLUSTER_COLORS.length] },
            hovertemplate: "Perfil %{fullData.name}<br>%{x}: %{y:.2f}σ<extra></extra>",
          }))}
          layout={{
            ...baseLayout,
            height: 410,
            title: { text: "Medias estandarizadas por perfil", font: { size: 12 } },
            yaxis: { title: { text: "Diferencia frente al promedio global (σ)" }, zeroline: true },
            barmode: "group",
          }}
          config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ["toImage"] }}
          style={{ width: "100%" }}
        />
      </div>
      <p className="text-xs text-gray-600">
        Lectura: compara C3 con los demás perfiles. Valores positivos están por encima del promedio global y valores negativos, por debajo. Es una asociación descriptiva, no un diagnóstico.
      </p>
    </section>
  );
}

export function ClusterCoverageEvidence() {
  const { analysisRun, rows, columns } = useStore();
  if (!analysisRun) {
    return (
      <MissingOfficialRun description="La cobertura general ya puede revisarse arriba. Para generar la cobertura separada por perfil, ejecuta primero K-means con 4 grupos en PCA / t-SNE / UMAP." />
    );
  }

  const rowById = new Map(rows.map((row, index) => [recordId(row, index), row]));
  const availableFlags = FLAGS.filter(([column]) => columns.includes(column));
  const runRecordIds = Object.keys(analysisRun.labels);
  const members = analysisRun.clusters.map((cluster) =>
    runRecordIds
      .filter((id) => analysisRun.labels[id] === cluster.label)
      .map((id) => rowById.get(id))
      .filter(Boolean) as DataRow[]
  );

  return (
    <section className="bg-white border border-gray-200 rounded p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <BarChart3 size={15} className="text-orange-500" /> Caso 4 generado: cobertura por perfil
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          El gráfico usa las etiquetas creadas previamente por K-means y calcula qué porcentaje de cada perfil tiene datos de cada fuente.
        </p>
      </div>
      <div className="border border-gray-100 rounded overflow-hidden">
        <Plot
          data={analysisRun.clusters.map((cluster) => ({
            type: "bar",
            name: `C${cluster.label} (${cluster.count})`,
            x: availableFlags.map(([, label]) => label),
            y: availableFlags.map(([column]) => mean(members[cluster.label].map((row) => numeric(row, column) || 0)) * 100),
            marker: { color: CLUSTER_COLORS[cluster.label % CLUSTER_COLORS.length] },
            hovertemplate: "Perfil %{fullData.name}<br>%{x}: %{y:.1f}%<extra></extra>",
          }))}
          layout={{
            ...baseLayout,
            height: 410,
            title: { text: "Cobertura de fuentes dentro de cada perfil", font: { size: 12 } },
            yaxis: { title: { text: "Participantes con datos (%)" }, range: [0, 105] },
            barmode: "group",
          }}
          config={{ displayModeBar: true, responsive: true, modeBarButtonsToRemove: ["toImage"] }}
          style={{ width: "100%" }}
        />
      </div>
      <p className="text-xs text-gray-600">
        Lectura: C0 debe interpretarse como mayor observabilidad multiplataforma. Una cobertura más alta no significa automáticamente mayor intensidad de juego.
      </p>
    </section>
  );
}
