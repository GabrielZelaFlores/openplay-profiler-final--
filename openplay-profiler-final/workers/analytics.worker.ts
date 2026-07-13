/// <reference lib="webworker" />
import { prepareNumericMatrix, runPCA, runTSNE, runUMAP } from "../lib/dimensionality-utils";
import { assessKMeansStability, runDBSCAN, runHierarchicalSingleLink, runKMeans, runKMeansVectors } from "../lib/clustering-utils";
import type { DataRow } from "../lib/store";
import type { Point2D } from "../lib/clustering-utils";

type Request =
  | { type: "projection"; method: "pca" | "umap" | "tsne"; rows: DataRow[]; variables: string[]; impute: "mean" | "median" | "zero" | "drop"; params: Record<string, number> }
  | { type: "clustering"; method: "kmeans" | "hierarchical-single" | "dbscan"; points: Point2D[]; params: Record<string, number> }
  | { type: "robustness"; rows: DataRow[]; variables: string[]; impute: "mean" | "median" | "zero" | "drop"; clusterCount: number };

self.onmessage = async (event: MessageEvent<Request>) => {
  try {
    const request = event.data;
    if (request.type === "projection") {
      const result = request.method === "pca"
        ? runPCA(request.rows, request.variables, request.impute)
        : request.method === "umap"
          ? await runUMAP(request.rows, request.variables, request.params, request.impute)
          : await runTSNE(request.rows, request.variables, request.params, request.impute,
              (value) => self.postMessage({ type: "progress", value }));
      self.postMessage({ type: "result", result });
      return;
    }
    if (request.type === "robustness") {
      const prepared = prepareNumericMatrix(request.rows, request.variables, request.impute);
      const fitted = runKMeansVectors(prepared.matrix, request.clusterCount, 100, 42);
      self.postMessage({ type: "result", result: {
        recordIds: prepared.rowIndices.map((index) => String(request.rows[index].record_id ?? index)),
        labels: fitted.labels,
        stability: assessKMeansStability(prepared.matrix, request.clusterCount, 8),
      } });
      return;
    }
    const result = request.method === "kmeans"
      ? runKMeans(request.points, request.params.clusterCount, 100, request.params.seed ?? 42)
      : request.method === "hierarchical-single"
        ? runHierarchicalSingleLink(request.points, request.params.clusterCount)
        : runDBSCAN(request.points, request.params.eps, request.params.minPts);
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({ type: "error", error: error instanceof Error ? error.message : String(error) });
  }
};

export {};
