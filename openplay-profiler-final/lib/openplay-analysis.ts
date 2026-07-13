import { runKMeansVectors } from "./clustering-utils";
import { parseNumericValue } from "./data-utils";
import { VALIDATION_PROFILE_VARIABLES } from "./openplay-vector";

export type AnalysisDataRow = Record<string, string | number | boolean | null>;

export const CANONICAL_CLUSTER_NAMES = [
  "Multiplataforma",
  "Base de menor intensidad relativa",
  "Alta intensidad total y nocturna",
  "Bienestar, riesgo y uso registrado",
] as const;

export interface AnalysisProfileValue {
  column: string;
  mean: number | null;
  globalMean: number | null;
  standardizedDifference: number;
  observed: number;
}

export interface AnalysisCluster {
  label: number;
  name: string;
  count: number;
  selectionScore: number;
  topVariables: AnalysisProfileValue[];
  profile: AnalysisProfileValue[];
}

export interface AnalysisRun {
  version: 1;
  dataset: {
    rows: number;
    firstRecordId: string;
    lastRecordId: string;
  };
  config: {
    features: string[];
    imputation: "median";
    standardization: "zscore";
    algorithm: "kmeans-original-space";
    clusterCount: 4;
    seed: number;
    iterations: number;
  };
  labels: Record<string, number>;
  rawToCanonical: Record<number, number>;
  clusters: AnalysisCluster[];
  iterationsRun: number;
  converged: boolean;
  sse: number;
}

function mean(values: number[]): number {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : NaN;
}

function median(values: number[]): number {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function std(values: number[], center = mean(values)): number {
  const clean = values.filter(Number.isFinite);
  if (clean.length < 2 || !Number.isFinite(center)) return 0;
  return Math.sqrt(clean.reduce((sum, value) => sum + (value - center) ** 2, 0) / clean.length);
}

function permutations(values: number[]): number[][] {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, itemIndex) => itemIndex !== index)).map((rest) => [value, ...rest])
  );
}

function valueFor(profile: AnalysisProfileValue[], column: string): number {
  return profile.find((item) => item.column === column)?.standardizedDifference ?? 0;
}

function canonicalScores(profile: AnalysisProfileValue[]) {
  const multiplatform =
    valueFor(profile, "num_platforms") + valueFor(profile, "num_telemetry_platforms");
  const intensity =
    valueFor(profile, "telem_total_sessions") + valueFor(profile, "telem_nocturnal_sessions");
  const riskAndUse =
    valueFor(profile, "promis_total") +
    valueFor(profile, "gdt_total") +
    valueFor(profile, "bangs_total") -
    valueFor(profile, "wemwbs_total") +
    0.5 * valueFor(profile, "timeuse_gaming_entries") +
    0.5 * valueFor(profile, "timeuse_num_days");
  const signatureColumns = [
    "num_platforms", "num_telemetry_platforms", "telem_total_sessions",
    "telem_nocturnal_sessions", "promis_total", "wemwbs_total", "gdt_total",
    "bangs_total", "timeuse_gaming_entries", "timeuse_num_days",
  ];
  const base = -signatureColumns.reduce(
    (sum, column) => sum + Math.abs(valueFor(profile, column)), 0
  ) / signatureColumns.length;
  return [multiplatform, base, intensity, riskAndUse];
}

export function createOpenPlayAnalysisRun(
  rows: AnalysisDataRow[],
  featureCandidates: string[],
  options: { seed?: number; iterations?: number } = {}
): AnalysisRun {
  if (rows.length < 4) throw new Error("Se necesitan al menos cuatro participantes para el analisis oficial.");
  const seed = options.seed ?? 2026;
  const iterations = options.iterations ?? 100;
  const features = featureCandidates.filter((column) =>
    rows.some((row) => Number.isFinite(parseNumericValue(row[column])))
  );
  if (features.length < 2) throw new Error("El analisis oficial requiere al menos dos variables numericas.");

  const medians = features.map((column) => median(rows.map((row) => parseNumericValue(row[column]))));
  const raw = rows.map((row) => features.map((column, columnIndex) => {
    const value = parseNumericValue(row[column]);
    return Number.isFinite(value) ? value : medians[columnIndex];
  }));
  const centers = features.map((_, columnIndex) => mean(raw.map((row) => row[columnIndex])));
  const scales = features.map((_, columnIndex) => std(raw.map((row) => row[columnIndex]), centers[columnIndex]) || 1);
  const standardized = raw.map((row) =>
    row.map((value, columnIndex) => (value - centers[columnIndex]) / scales[columnIndex])
  );
  const fitted = runKMeansVectors(standardized, 4, iterations, seed);

  const profileColumns = Array.from(new Set([...VALIDATION_PROFILE_VARIABLES, ...features]))
    .filter((column) => rows.some((row) => Number.isFinite(parseNumericValue(row[column]))));
  const globalStats = Object.fromEntries(profileColumns.map((column) => {
    const values = rows.map((row) => parseNumericValue(row[column])).filter(Number.isFinite);
    const globalMean = mean(values);
    return [column, { mean: globalMean, std: std(values, globalMean) || 1 }];
  })) as Record<string, { mean: number; std: number }>;

  const rawProfiles = Array.from({ length: 4 }, (_, rawLabel) => {
    const memberIndices = fitted.labels
      .map((label, index) => label === rawLabel ? index : -1)
      .filter((index) => index >= 0);
    return profileColumns.map((column): AnalysisProfileValue => {
      const values = memberIndices
        .map((index) => parseNumericValue(rows[index][column]))
        .filter(Number.isFinite);
      const clusterMean = mean(values);
      const global = globalStats[column];
      return {
        column,
        mean: Number.isFinite(clusterMean) ? clusterMean : null,
        globalMean: Number.isFinite(global.mean) ? global.mean : null,
        standardizedDifference: Number.isFinite(clusterMean) ? (clusterMean - global.mean) / global.std : 0,
        observed: values.length,
      };
    });
  });

  const scoreMatrix = rawProfiles.map(canonicalScores);
  const bestAssignment = permutations([0, 1, 2, 3])
    .map((rawForCanonical) => ({
      rawForCanonical,
      score: rawForCanonical.reduce(
        (sum, rawLabel, canonicalLabel) => sum + scoreMatrix[rawLabel][canonicalLabel], 0
      ),
    }))
    .sort((a, b) => b.score - a.score)[0];
  const rawToCanonical = Object.fromEntries(
    bestAssignment.rawForCanonical.map((rawLabel, canonicalLabel) => [rawLabel, canonicalLabel])
  ) as Record<number, number>;
  const canonicalLabels = fitted.labels.map((rawLabel) => rawToCanonical[rawLabel]);
  const labels: Record<string, number> = {};
  rows.forEach((row, index) => {
    labels[String(row.record_id ?? row.pid ?? index)] = canonicalLabels[index];
  });

  const clusters = bestAssignment.rawForCanonical.map((rawLabel, canonicalLabel): AnalysisCluster => {
    const profile = rawProfiles[rawLabel];
    return {
      label: canonicalLabel,
      name: CANONICAL_CLUSTER_NAMES[canonicalLabel],
      count: canonicalLabels.filter((label) => label === canonicalLabel).length,
      selectionScore: scoreMatrix[rawLabel][canonicalLabel],
      profile,
      topVariables: [...profile]
        .sort((a, b) => Math.abs(b.standardizedDifference) - Math.abs(a.standardizedDifference))
        .slice(0, 8),
    };
  });

  return {
    version: 1,
    dataset: {
      rows: rows.length,
      firstRecordId: String(rows[0]?.record_id ?? rows[0]?.pid ?? "0"),
      lastRecordId: String(rows.at(-1)?.record_id ?? rows.at(-1)?.pid ?? rows.length - 1),
    },
    config: {
      features,
      imputation: "median",
      standardization: "zscore",
      algorithm: "kmeans-original-space",
      clusterCount: 4,
      seed,
      iterations,
    },
    labels,
    rawToCanonical,
    clusters,
    iterationsRun: fitted.iterationsRun,
    converged: fitted.converged,
    sse: fitted.sse,
  };
}

export function analysisRunMatches(
  run: AnalysisRun | null,
  rows: AnalysisDataRow[],
  features: string[]
): boolean {
  if (!run || run.dataset.rows !== rows.length) return false;
  if (run.dataset.firstRecordId !== String(rows[0]?.record_id ?? rows[0]?.pid ?? "0")) return false;
  if (run.dataset.lastRecordId !== String(rows.at(-1)?.record_id ?? rows.at(-1)?.pid ?? rows.length - 1)) return false;
  return run.config.features.length === features.length &&
    run.config.features.every((feature, index) => feature === features[index]);
}

