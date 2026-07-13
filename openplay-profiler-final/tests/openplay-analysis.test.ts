import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { createOpenPlayAnalysisRun } from "../lib/openplay-analysis";

const features = [
  "num_platforms", "num_telemetry_platforms", "telem_nocturnal_sessions",
  "telem_total_sessions", "promis_total", "wemwbs_total", "gdt_total",
  "bangs_total", "timeuse_gaming_entries", "timeuse_num_days",
];

function rowsForProfiles() {
  const rows: Record<string, string | number | boolean | null>[] = [];
  const add = (prefix: string, count: number, values: Record<string, number>) => {
    for (let index = 0; index < count; index++) {
      rows.push({
        record_id: `${prefix}-${index}`,
        num_platforms: 1,
        num_telemetry_platforms: 1,
        telem_nocturnal_sessions: 5,
        telem_total_sessions: 20,
        promis_total: 20,
        wemwbs_total: 25,
        gdt_total: 3,
        bangs_total: 60,
        timeuse_gaming_entries: 5,
        timeuse_num_days: 5,
        ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value + index * 0.01])),
      });
    }
  };
  add("multi", 12, { num_platforms: 9, num_telemetry_platforms: 8 });
  add("base", 12, {});
  add("intensity", 12, { telem_nocturnal_sessions: 600, telem_total_sessions: 1200 });
  add("risk", 12, { promis_total: 80, wemwbs_total: 3, gdt_total: 18, bangs_total: 120, timeuse_gaming_entries: 90, timeuse_num_days: 40 });
  return rows;
}

describe("ejecucion analitica oficial", () => {
  it("asigna etiquetas canonicas por significado y no por el orden bruto de K-means", () => {
    const run = createOpenPlayAnalysisRun(rowsForProfiles(), features, { seed: 2026 });
    expect(run.labels["multi-0"]).toBe(0);
    expect(run.labels["base-0"]).toBe(1);
    expect(run.labels["intensity-0"]).toBe(2);
    expect(run.labels["risk-0"]).toBe(3);
    expect(run.clusters.map((cluster) => cluster.count)).toEqual([12, 12, 12, 12]);
  });

  it("es reproducible con la misma configuracion", () => {
    const first = createOpenPlayAnalysisRun(rowsForProfiles(), features, { seed: 2026 });
    const second = createOpenPlayAnalysisRun(rowsForProfiles(), features, { seed: 2026 });
    expect(second.labels).toEqual(first.labels);
    expect(second.rawToCanonical).toEqual(first.rawToCanonical);
  });

  it("mantiene sincronizado el artefacto publico con el dataset", () => {
    const artifact = JSON.parse(fs.readFileSync("public/data/openplay_analysis_run.json", "utf8"));
    const csvRows = fs.readFileSync("public/data/openplay_consolidated.csv", "utf8").trim().split(/\r?\n/).length - 1;
    expect(artifact.dataset.rows).toBe(csvRows);
    expect(Object.keys(artifact.labels)).toHaveLength(csvRows);
    expect(artifact.clusters.reduce((sum: number, cluster: { count: number }) => sum + cluster.count, 0)).toBe(csvRows);
  });
});

