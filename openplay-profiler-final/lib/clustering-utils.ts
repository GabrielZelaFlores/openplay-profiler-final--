import type { DataValue } from "./store";

export type Point2D = {
  record_id: DataValue;
  x: number;
  y: number;
};

export type ClusterLabel = number | -1;

export interface ClusterResult {
  method: "kmeans" | "hierarchical-single" | "dbscan";
  labels: Record<string, ClusterLabel>;
  clusters: {
    label: ClusterLabel;
    count: number;
    centroidX: number;
    centroidY: number;
  }[];
  noiseCount: number;
  metrics: {
    withinClusterSSE: number;
    meanDistanceToCentroid: number;
    minCentroidDistance: number | null;
    sizeBalanceRatio: number | null;
    silhouetteApprox: number | null;
    silhouetteSampleSize: number;
  };
  parameters: Record<string, number | string>;
}

export interface VectorKMeansResult {
  labels: number[];
  centers: number[][];
  iterationsRun: number;
  converged: boolean;
  sse: number;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function vectorDistance(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0);
}

export function runKMeansVectors(
  vectors: number[][],
  clusterCount: number,
  iterations = 80,
  seed = 42
): VectorKMeansResult {
  if (vectors.length < 2 || !vectors[0]?.length) throw new Error("Se necesitan al menos 2 vectores no vacios.");
  if (vectors.some((row) => row.length !== vectors[0].length || row.some((value) => !Number.isFinite(value)))) {
    throw new Error("K-means requiere una matriz rectangular de valores finitos.");
  }
  const n = vectors.length;
  const k = Math.max(2, Math.min(Math.floor(clusterCount), n));
  const random = seededRandom(seed);
  const centers: number[][] = [vectors[Math.floor(random() * n)].slice()];
  while (centers.length < k) {
    const distances = vectors.map((vector) => Math.min(...centers.map((center) => vectorDistance(vector, center))));
    const total = distances.reduce((sum, distance) => sum + distance, 0);
    if (total === 0) {
      const unused = vectors.find((vector) => !centers.some((center) => vectorDistance(vector, center) === 0));
      centers.push((unused ?? vectors[centers.length % n]).slice());
      continue;
    }
    let target = random() * total;
    let index = 0;
    for (; index < n - 1; index++) {
      target -= distances[index];
      if (target <= 0) break;
    }
    centers.push(vectors[index].slice());
  }

  let labels = new Array<number>(n).fill(-1);
  let converged = false;
  let iterationsRun = 0;
  for (let iteration = 0; iteration < iterations; iteration++) {
    iterationsRun = iteration + 1;
    const nextLabels = vectors.map((vector) => {
      let best = 0;
      for (let c = 1; c < centers.length; c++) {
        if (vectorDistance(vector, centers[c]) < vectorDistance(vector, centers[best])) best = c;
      }
      return best;
    });
    converged = nextLabels.every((label, index) => label === labels[index]);
    labels = nextLabels;
    for (let c = 0; c < k; c++) {
      const members = vectors.filter((_, index) => labels[index] === c);
      if (!members.length) {
        const farthest = vectors
          .map((vector, index) => ({ index, distance: vectorDistance(vector, centers[labels[index]]) }))
          .sort((a, b) => b.distance - a.distance)[0].index;
        labels[farthest] = c;
        centers[c] = vectors[farthest].slice();
      } else {
        centers[c] = centers[c].map((_, dimension) =>
          members.reduce((sum, vector) => sum + vector[dimension], 0) / members.length
        );
      }
    }
    if (converged) break;
  }
  const sse = vectors.reduce((sum, vector, index) => sum + vectorDistance(vector, centers[labels[index]]), 0);
  return { labels, centers, iterationsRun, converged, sse };
}

class UnionFind {
  private parent: number[];
  private size: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.size = new Array(n).fill(1);
  }

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }

  union(a: number, b: number): boolean {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return false;
    if (this.size[ra] < this.size[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    this.size[ra] += this.size[rb];
    return true;
  }
}

function squaredDistance(a: Point2D, b: Point2D) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function squaredDistanceToCenter(point: Point2D, center: { x: number; y: number }) {
  return (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
}

function computeMetrics(
  points: Point2D[],
  labelsByIndex: ClusterLabel[],
  clusters: ClusterResult["clusters"]
): ClusterResult["metrics"] {
  const realClusters = clusters.filter((cluster) => cluster.label !== -1);
  const clusterByLabel = new Map(realClusters.map((cluster) => [cluster.label, cluster]));
  const validIndices = labelsByIndex
    .map((label, index) => ({ label, index }))
    .filter(({ label }) => label !== -1 && clusterByLabel.has(label));

  let withinClusterSSE = 0;
  for (const { label, index } of validIndices) {
    const center = clusterByLabel.get(label)!;
    withinClusterSSE += squaredDistanceToCenter(points[index], {
      x: center.centroidX,
      y: center.centroidY,
    });
  }

  const meanDistanceToCentroid = validIndices.length
    ? validIndices.reduce((sum, { label, index }) => {
        const center = clusterByLabel.get(label)!;
        return sum + Math.sqrt(squaredDistanceToCenter(points[index], {
          x: center.centroidX,
          y: center.centroidY,
        }));
      }, 0) / validIndices.length
    : 0;

  let minCentroidDistance: number | null = null;
  for (let i = 0; i < realClusters.length; i++) {
    for (let j = i + 1; j < realClusters.length; j++) {
      const distance = Math.hypot(
        realClusters[i].centroidX - realClusters[j].centroidX,
        realClusters[i].centroidY - realClusters[j].centroidY
      );
      minCentroidDistance = minCentroidDistance === null
        ? distance
        : Math.min(minCentroidDistance, distance);
    }
  }

  const sizes = realClusters.map((cluster) => cluster.count).filter((count) => count > 0);
  const sizeBalanceRatio = sizes.length > 1 ? Math.min(...sizes) / Math.max(...sizes) : null;

  const silhouetteMaxSample = 800;
  const sampleStep = validIndices.length > silhouetteMaxSample
    ? Math.ceil(validIndices.length / silhouetteMaxSample)
    : 1;
  const sample = validIndices.filter((_, index) => index % sampleStep === 0).slice(0, silhouetteMaxSample);

  let silhouetteSum = 0;
  let silhouetteCount = 0;
  if (realClusters.length > 1) {
    for (const item of sample) {
      const sameCluster: number[] = [];
      const otherClusters = new Map<ClusterLabel, number[]>();
      for (const other of validIndices) {
        if (other.index === item.index) continue;
        const distance = Math.sqrt(squaredDistance(points[item.index], points[other.index]));
        if (other.label === item.label) {
          sameCluster.push(distance);
        } else {
          if (!otherClusters.has(other.label)) otherClusters.set(other.label, []);
          otherClusters.get(other.label)!.push(distance);
        }
      }

      if (!sameCluster.length || otherClusters.size === 0) continue;
      const a = sameCluster.reduce((sum, distance) => sum + distance, 0) / sameCluster.length;
      const b = Math.min(
        ...Array.from(otherClusters.values()).map(
          (distances) => distances.reduce((sum, distance) => sum + distance, 0) / distances.length
        )
      );
      const denom = Math.max(a, b);
      if (denom > 0) {
        silhouetteSum += (b - a) / denom;
        silhouetteCount++;
      }
    }
  }

  return {
    withinClusterSSE,
    meanDistanceToCentroid,
    minCentroidDistance,
    sizeBalanceRatio,
    silhouetteApprox: silhouetteCount ? silhouetteSum / silhouetteCount : null,
    silhouetteSampleSize: silhouetteCount,
  };
}

function summarize(points: Point2D[], labelsByIndex: ClusterLabel[], method: ClusterResult["method"], parameters: ClusterResult["parameters"]): ClusterResult {
  const labels: Record<string, ClusterLabel> = {};
  const buckets = new Map<ClusterLabel, Point2D[]>();

  points.forEach((point, index) => {
    const label = labelsByIndex[index];
    labels[String(point.record_id)] = label;
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(point);
  });

  const clusters = Array.from(buckets.entries())
    .map(([label, members]) => ({
      label,
      count: members.length,
      centroidX: members.reduce((sum, p) => sum + p.x, 0) / members.length,
      centroidY: members.reduce((sum, p) => sum + p.y, 0) / members.length,
    }))
    .sort((a, b) => {
      if (a.label === -1) return 1;
      if (b.label === -1) return -1;
      return b.count - a.count;
    });

  return {
    method,
    labels,
    clusters,
    noiseCount: buckets.get(-1)?.length ?? 0,
    metrics: computeMetrics(points, labelsByIndex, clusters),
    parameters,
  };
}

export function summarizeAssignedClusters(
  points: Point2D[],
  labels: Record<string, ClusterLabel>,
  parameters: ClusterResult["parameters"] = {}
): ClusterResult {
  const labelsByIndex = points.map((point) => labels[String(point.record_id)] ?? -1);
  return summarize(points, labelsByIndex, "kmeans", {
    source: "official-original-space",
    ...parameters,
  });
}

export function runKMeans(points: Point2D[], clusterCount: number, iterations = 80, seed = 42): ClusterResult {
  const n = points.length;
  if (n < 2) throw new Error("Se necesitan al menos 2 puntos para K-means.");
  const vectorResult = runKMeansVectors(points.map((point) => [point.x, point.y]), clusterCount, iterations, seed);
  const labelsByIndex: ClusterLabel[] = vectorResult.labels;

  return summarize(points, labelsByIndex, "kmeans", {
    clusters: vectorResult.centers.length,
    iterations: vectorResult.iterationsRun,
    seed,
    distance: "euclidean",
  });
}

export function adjustedRandIndex(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return NaN;
  const choose2 = (n: number) => n * (n - 1) / 2;
  const contingency = new Map<string, number>();
  const rows = new Map<number, number>();
  const cols = new Map<number, number>();
  for (let i = 0; i < a.length; i++) {
    const key = `${a[i]}:${b[i]}`;
    contingency.set(key, (contingency.get(key) ?? 0) + 1);
    rows.set(a[i], (rows.get(a[i]) ?? 0) + 1);
    cols.set(b[i], (cols.get(b[i]) ?? 0) + 1);
  }
  const pairs = [...contingency.values()].reduce((sum, n) => sum + choose2(n), 0);
  const rowPairs = [...rows.values()].reduce((sum, n) => sum + choose2(n), 0);
  const colPairs = [...cols.values()].reduce((sum, n) => sum + choose2(n), 0);
  const totalPairs = choose2(a.length);
  const expected = rowPairs * colPairs / totalPairs;
  const maximum = (rowPairs + colPairs) / 2;
  return maximum === expected ? 1 : (pairs - expected) / (maximum - expected);
}

export function assessKMeansStability(vectors: number[][], k: number, runs = 8) {
  const solutions = Array.from({ length: Math.max(2, runs) }, (_, index) =>
    runKMeansVectors(vectors, k, 100, 2026 + index).labels
  );
  const scores: number[] = [];
  for (let i = 0; i < solutions.length; i++) {
    for (let j = i + 1; j < solutions.length; j++) scores.push(adjustedRandIndex(solutions[i], solutions[j]));
  }
  return {
    runs: solutions.length,
    meanAdjustedRand: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    minAdjustedRand: Math.min(...scores),
  };
}

export function runHierarchicalSingleLink(points: Point2D[], clusterCount: number): ClusterResult {
  const n = points.length;
  if (n < 2) throw new Error("Se necesitan al menos 2 puntos para clustering jerarquico.");

  const k = Math.max(1, Math.min(Math.floor(clusterCount), n));
  const inTree = new Array(n).fill(false);
  const minDist = new Array(n).fill(Infinity);
  const parent = new Array(n).fill(-1);
  const mstEdges: { a: number; b: number; d: number }[] = [];

  minDist[0] = 0;
  for (let step = 0; step < n; step++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!inTree[i] && minDist[i] < best) {
        best = minDist[i];
        u = i;
      }
    }
    if (u === -1) break;
    inTree[u] = true;
    if (parent[u] !== -1) mstEdges.push({ a: parent[u], b: u, d: best });

    for (let v = 0; v < n; v++) {
      if (inTree[v] || v === u) continue;
      const d = squaredDistance(points[u], points[v]);
      if (d < minDist[v]) {
        minDist[v] = d;
        parent[v] = u;
      }
    }
  }

  const keptEdges = [...mstEdges].sort((a, b) => b.d - a.d).slice(0, k - 1);
  const cut = new Set(keptEdges.map((edge) => `${edge.a}:${edge.b}`));
  const uf = new UnionFind(n);

  for (const edge of mstEdges) {
    if (!cut.has(`${edge.a}:${edge.b}`)) uf.union(edge.a, edge.b);
  }

  const rootToLabel = new Map<number, number>();
  const labelsByIndex = points.map((_, i) => {
    const root = uf.find(i);
    if (!rootToLabel.has(root)) rootToLabel.set(root, rootToLabel.size);
    return rootToLabel.get(root)!;
  });

  return summarize(points, labelsByIndex, "hierarchical-single", {
    clusters: k,
    linkage: "single",
    distance: "euclidean",
  });
}

export function runDBSCAN(points: Point2D[], eps: number, minPts: number): ClusterResult {
  const n = points.length;
  if (n < 2) throw new Error("Se necesitan al menos 2 puntos para DBSCAN.");
  const radius = Math.max(eps, 0);
  const minNeighbors = Math.max(2, Math.floor(minPts));
  const eps2 = radius ** 2;
  const labelsByIndex: ClusterLabel[] = new Array(n).fill(-1);
  const visited = new Array(n).fill(false);
  let clusterId = 0;

  const neighborsOf = (idx: number) => {
    const neighbors: number[] = [];
    for (let i = 0; i < n; i++) {
      if (squaredDistance(points[idx], points[i]) <= eps2) neighbors.push(i);
    }
    return neighbors;
  };

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const neighbors = neighborsOf(i);
    if (neighbors.length < minNeighbors) {
      labelsByIndex[i] = -1;
      continue;
    }

    labelsByIndex[i] = clusterId;
    const queue = [...neighbors];
    for (let q = 0; q < queue.length; q++) {
      const idx = queue[q];
      if (!visited[idx]) {
        visited[idx] = true;
        const idxNeighbors = neighborsOf(idx);
        if (idxNeighbors.length >= minNeighbors) {
          for (const candidate of idxNeighbors) {
            if (!queue.includes(candidate)) queue.push(candidate);
          }
        }
      }
      if (labelsByIndex[idx] === -1) labelsByIndex[idx] = clusterId;
    }
    clusterId++;
  }

  return summarize(points, labelsByIndex, "dbscan", {
    eps: radius,
    minPts: minNeighbors,
    distance: "euclidean",
  });
}
