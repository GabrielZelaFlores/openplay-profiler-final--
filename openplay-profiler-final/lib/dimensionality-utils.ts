import type { DataRow, DataValue } from "./store";
import { parseNumericValue } from "./data-utils";

function createSeededRandom(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function orientVector(vec: number[]): number[] {
  let strongest = 0;
  for (let i = 1; i < vec.length; i++) {
    if (Math.abs(vec[i]) > Math.abs(vec[strongest])) strongest = i;
  }
  return vec[strongest] < 0 ? vec.map((value) => -value) : vec;
}

// ─── Construcción de matriz numérica ────────────────────────────────────────
export function buildMatrix(
  rows: DataRow[],
  variables: string[]
): { matrix: number[][]; rowIndices: number[] } {
  const matrix: number[][] = [];
  const rowIndices: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const vec = variables.map((col) => {
      return parseNumericValue(row[col]);
    });
    matrix.push(vec);
    rowIndices.push(i);
  }
  return { matrix, rowIndices };
}

// ─── Imputación ──────────────────────────────────────────────────────────────
function impute(
  matrix: number[][],
  method: "mean" | "zero" | "drop"
): { matrix: number[][]; validIndices: number[] } {
  const ncols = matrix[0]?.length ?? 0;
  if (method === "drop") {
    const valid = matrix
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => row.every((v) => isFinite(v)));
    return { matrix: valid.map((x) => x.row), validIndices: valid.map((x) => x.i) };
  }
  const colMeans = Array.from({ length: ncols }, (_, j) => {
    const vals = matrix.map((r) => r[j]).filter((v) => isFinite(v));
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
  const filled = matrix.map((row) =>
    row.map((v, j) => (isFinite(v) ? v : method === "mean" ? colMeans[j] : 0))
  );
  return { matrix: filled, validIndices: matrix.map((_, i) => i) };
}

// ─── Estandarización ─────────────────────────────────────────────────────────
function standardize(matrix: number[][]): number[][] {
  if (!matrix.length || !matrix[0].length) return matrix;
  const ncols = matrix[0].length;
  const n = matrix.length;
  return matrix.map((row) =>
    row.map((_, j) => {
      const vals = matrix.map((r) => r[j]);
      const m = vals.reduce((a, b) => a + b, 0) / n;
      const s = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / n);
      return s > 0 ? (row[j] - m) / s : 0;
    })
  );
}

// ─── PCA ─────────────────────────────────────────────────────────────────────
export function runPCA(
  rows: DataRow[],
  variables: string[],
  imputeMethod: "mean" | "zero" | "drop" = "mean"
): {
  coordinates: { record_id: DataValue; x: number; y: number }[];
  metadata: {
    rowsUsed: number;
    rowsExcluded: number;
    variablesUsed: string[];
    explainedVariance: number[];
    loadings: Record<string, number[]>;
  };
} {
  const { matrix: raw, rowIndices } = buildMatrix(rows, variables);
  const { matrix: imp, validIndices } = impute(raw, imputeMethod);
  const std = standardize(imp);
  const n = std.length;
  const p = variables.length;

  if (n < 2 || p < 1) throw new Error("Datos insuficientes para PCA");

  // Matriz de covarianza p×p
  const cov: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += std[k][i] * std[k][j];
      cov[i][j] = cov[j][i] = s / Math.max(n - 1, 1);
    }
  }

  // Iteración de potencia para PC1 y PC2
  function powerIter(componentIndex: number, deflate?: number[]): { vec: number[]; val: number } {
    let v = Array.from({ length: p }, (_, i) => {
      const angle = (i + 1) * (componentIndex + 1) * 1.61803398875;
      return Math.sin(angle) + 0.5 * Math.cos(angle * 0.5);
    });
    const norm = (a: number[]) => Math.sqrt(a.reduce((s, x) => s + x * x, 0));

    if (deflate) {
      const dot = v.reduce((s, vi, i) => s + vi * deflate[i], 0);
      v = v.map((vi, i) => vi - dot * deflate[i]);
    }
    let vn = v.map((x) => x / (norm(v) || 1));

    for (let iter = 0; iter < 300; iter++) {
      let Mv = cov.map((row) => row.reduce((s, x, j) => s + x * vn[j], 0));
      if (deflate) {
        const d = Mv.reduce((s, x, i) => s + x * deflate[i], 0);
        Mv = Mv.map((x, i) => x - d * deflate[i]);
      }
      const n2 = norm(Mv);
      if (n2 < 1e-10) break;
      vn = Mv.map((x) => x / n2);
    }
    const Mv = cov.map((row) => row.reduce((s, x, j) => s + x * vn[j], 0));
    const val = vn.reduce((s, x, i) => s + x * Mv[i], 0);
    return { vec: orientVector(vn), val };
  }

  const pc1 = powerIter(0);
  const pc2 = p > 1 ? powerIter(1, pc1.vec) : { vec: new Array(p).fill(0), val: 0 };
  const totalVar = cov.reduce((s, _, i) => s + cov[i][i], 0) || 1;

  const coords = std.map((row) => ({
    x: row.reduce((s, v, i) => s + v * pc1.vec[i], 0),
    y: row.reduce((s, v, i) => s + v * pc2.vec[i], 0),
  }));

  const actualRows = validIndices.map((vi) => rowIndices[vi]);
  return {
    coordinates: actualRows.map((ri, ci) => ({
      record_id: rows[ri]["record_id"] ?? ri,
      x: coords[ci].x,
      y: coords[ci].y,
    })),
    metadata: {
      rowsUsed: actualRows.length,
      rowsExcluded: rows.length - actualRows.length,
      variablesUsed: variables,
      explainedVariance: [pc1.val / totalVar, pc2.val / totalVar],
      loadings: { PC1: pc1.vec, PC2: pc2.vec },
    },
  };
}

// ─── UMAP ─────────────────────────────────────────────────────────────────────
export async function runUMAP(
  rows: DataRow[],
  variables: string[],
  params: { nNeighbors?: number; minDist?: number; spread?: number } = {},
  imputeMethod: "mean" | "zero" | "drop" = "mean"
) {
  const { UMAP } = await import("umap-js");
  const { matrix: raw, rowIndices } = buildMatrix(rows, variables);
  const { matrix: imp, validIndices } = impute(raw, imputeMethod);
  const std = standardize(imp);
  const actualRows = validIndices.map((vi) => rowIndices[vi]);

  const umap = new UMAP({
    nNeighbors: params.nNeighbors ?? 15,
    minDist: params.minDist ?? 0.1,
    spread: params.spread ?? 1,
    nComponents: 2,
  });

  const embedding = umap.fit(std);

  return {
    coordinates: actualRows.map((ri, ci) => ({
      record_id: rows[ri]["record_id"] ?? ri,
      x: embedding[ci][0],
      y: embedding[ci][1],
    })),
    metadata: {
      rowsUsed: actualRows.length,
      rowsExcluded: rows.length - actualRows.length,
      variablesUsed: variables,
    },
  };
}

// ─── t-SNE ───────────────────────────────────────────────────────────────────
export async function runTSNE(
  rows: DataRow[],
  variables: string[],
  params: { perplexity?: number; iterations?: number; learningRate?: number } = {},
  imputeMethod: "mean" | "zero" | "drop" = "mean",
  onProgress?: (pct: number) => void
) {
  const { matrix: raw, rowIndices } = buildMatrix(rows, variables);
  const { matrix: imp, validIndices } = impute(raw, imputeMethod);
  const std = standardize(imp);
  const actualRows = validIndices.map((vi) => rowIndices[vi]);
  const n = std.length;

  const perplexity = Math.min(params.perplexity ?? 30, Math.max(2, Math.floor((n - 1) / 3)));
  const iterations = params.iterations ?? 500;
  const eta = params.learningRate ?? 200;

  // Distancias euclidianas al cuadrado
  const D: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let d = 0;
      for (let k = 0; k < std[0].length; k++) d += (std[i][k] - std[j][k]) ** 2;
      D[i][j] = D[j][i] = d;
    }
  }

  // Matriz P con búsqueda binaria de sigma
  const P: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    let betaMin = -Infinity, betaMax = Infinity, beta = 1;
    for (let it = 0; it < 50; it++) {
      const Pi = D[i].map((d, j) => (j === i ? 0 : Math.exp(-d * beta)));
      const sumPi = Pi.reduce((a, b) => a + b, 0) || 1e-10;
      const expectedDistance = D[i].reduce((a, d, j) => a + (Pi[j] / sumPi) * d, 0);
      const H = Math.log(sumPi) + beta * expectedDistance;
      const Hdiff = H - Math.log(perplexity);
      if (Math.abs(Hdiff) < 1e-5) break;
      if (Hdiff > 0) { betaMin = beta; beta = betaMax === Infinity ? beta * 2 : (beta + betaMax) / 2; }
      else { betaMax = beta; beta = betaMin === -Infinity ? beta / 2 : (beta + betaMin) / 2; }
    }
    const Pi = D[i].map((d, j) => (j === i ? 0 : Math.exp(-d * beta)));
    const sumPi = Pi.reduce((a, b) => a + b, 0) || 1e-10;
    P[i] = Pi.map((p) => p / sumPi);
  }
  // Simetrizar y normalizar
  const symP: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      symP[i][j] = (P[i][j] + P[j][i]) / (2 * n);
    }
  }

  // Inicializar embedding
  const random = createSeededRandom(2026);
  const P2 = symP;
  const Y = Array.from({ length: n }, () => [(random() - 0.5) * 1e-4, (random() - 0.5) * 1e-4]);
  let dY = Array.from({ length: n }, () => [0, 0]);
  let gains = Array.from({ length: n }, () => [1.0, 1.0]);

  const BATCH = 20; // Yield cada N iteraciones
  for (let iter = 0; iter < iterations; iter++) {
    if (iter % BATCH === 0) {
      onProgress?.(Math.round((iter / iterations) * 100));
      await new Promise((r) => setTimeout(r, 0));
    }

    // Q matrix
    const num: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    let sumQ = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = 1 / (1 + (Y[i][0] - Y[j][0]) ** 2 + (Y[i][1] - Y[j][1]) ** 2);
        num[i][j] = num[j][i] = d;
        sumQ += 2 * d;
      }
    }
    if (sumQ === 0) sumQ = 1e-10;

    const ex = iter < 100 ? 4 : 1;
    const newdY = Array.from({ length: n }, () => [0, 0]);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const f = (ex * P2[i][j] - num[i][j] / sumQ) * num[i][j];
        newdY[i][0] += 4 * f * (Y[i][0] - Y[j][0]);
        newdY[i][1] += 4 * f * (Y[i][1] - Y[j][1]);
      }
    }

    for (let i = 0; i < n; i++) {
      for (let d = 0; d < 2; d++) {
        gains[i][d] = Math.max(
          0.01,
          Math.sign(newdY[i][d]) !== Math.sign(dY[i][d])
            ? gains[i][d] + 0.2
            : gains[i][d] * 0.8
        );
        dY[i][d] = 0.9 * dY[i][d] - eta * gains[i][d] * newdY[i][d];
        Y[i][d] += dY[i][d];
      }
    }

    const meanX = Y.reduce((sum, point) => sum + point[0], 0) / n;
    const meanY = Y.reduce((sum, point) => sum + point[1], 0) / n;
    for (let i = 0; i < n; i++) {
      Y[i][0] -= meanX;
      Y[i][1] -= meanY;
    }
  }

  onProgress?.(100);
  return {
    coordinates: actualRows.map((ri, ci) => ({
      record_id: rows[ri]["record_id"] ?? ri,
      x: Y[ci][0],
      y: Y[ci][1],
    })),
    metadata: {
      rowsUsed: actualRows.length,
      rowsExcluded: rows.length - actualRows.length,
      variablesUsed: variables,
    },
  };
}
