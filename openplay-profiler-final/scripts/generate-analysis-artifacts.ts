import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCSVText } from "../lib/csv-utils";
import { parseNumericValue } from "../lib/data-utils";
import { createOpenPlayAnalysisRun } from "../lib/openplay-analysis";
import { RECOMMENDED_PROJECT_VECTOR } from "../lib/openplay-vector";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "public", "data", "openplay_consolidated.csv");
const rows = parseCSVText(fs.readFileSync(dataPath, "utf8")).rows;
const run = createOpenPlayAnalysisRun(rows, RECOMMENDED_PROJECT_VECTOR, { seed: 2026, iterations: 100 });

const publicPath = path.join(root, "public", "data", "openplay_analysis_run.json");
const reportPath = path.join(root, "informe", "figures", "analysis_run.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const serialized = `${JSON.stringify(run, null, 2)}\n`;
fs.writeFileSync(publicPath, serialized, "utf8");
fs.writeFileSync(reportPath, serialized, "utf8");

const summaryColumns = [
  "telem_nocturnal_sessions", "telem_total_sessions", "num_platforms",
  "num_telemetry_platforms", "timeuse_num_days", "timeuse_gaming_entries",
  "promis_total", "wemwbs_total", "gdt_total", "bangs_total",
];
const mean = (values: number[]) => {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : NaN;
};
const header = ["cluster", "perfil", "participantes", ...summaryColumns].join(",");
const lines = run.clusters.map((cluster) => {
  const members = rows.filter((row, index) =>
    run.labels[String(row.record_id ?? row.pid ?? index)] === cluster.label
  );
  return [
    cluster.label,
    `"${cluster.name.replaceAll('"', '""')}"`,
    cluster.count,
    ...summaryColumns.map((column) => mean(members.map((row) => parseNumericValue(row[column]))).toFixed(4)),
  ].join(",");
});
fs.writeFileSync(path.join(root, "informe", "figures", "cluster_summary.csv"), `${header}\n${lines.join("\n")}\n`, "utf8");

console.log(`Analisis oficial: ${run.dataset.rows} participantes, ${run.config.features.length} variables.`);
for (const cluster of run.clusters) {
  console.log(`C${cluster.label} ${cluster.name}: ${cluster.count}`);
}

