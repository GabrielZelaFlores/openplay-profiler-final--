import type { DataRow, DimResult } from "./store";
import type { ClusterResult, Point2D } from "./clustering-utils";

type ProjectionResult = { coordinates: DimResult["coordinates"]; metadata: DimResult["metadata"] };

function executeWorker<T>(payload: unknown, onProgress?: (value: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/analytics.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<{ type: string; value?: number; result?: T; error?: string }>) => {
      if (event.data.type === "progress") onProgress?.(event.data.value ?? 0);
      if (event.data.type === "result") { worker.terminate(); resolve(event.data.result as T); }
      if (event.data.type === "error") { worker.terminate(); reject(new Error(event.data.error)); }
    };
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message)); };
    worker.postMessage(payload);
  });
}

export function runProjectionInWorker(
  method: "pca" | "umap" | "tsne",
  rows: DataRow[], variables: string[], impute: "mean" | "median" | "zero" | "drop",
  params: Record<string, number>, onProgress?: (value: number) => void
) {
  return executeWorker<ProjectionResult>({ type: "projection", method, rows, variables, impute, params }, onProgress);
}

export function runClusteringInWorker(
  method: "kmeans" | "hierarchical-single" | "dbscan",
  points: Point2D[], params: Record<string, number>
) {
  return executeWorker<ClusterResult>({ type: "clustering", method, points, params });
}

export function assessOriginalSpaceInWorker(
  rows: DataRow[], variables: string[], impute: "mean" | "median" | "zero" | "drop", clusterCount: number
) {
  return executeWorker<{
    recordIds: string[];
    labels: number[];
    stability: { runs: number; meanAdjustedRand: number; minAdjustedRand: number };
  }>({ type: "robustness", rows, variables, impute, clusterCount });
}
