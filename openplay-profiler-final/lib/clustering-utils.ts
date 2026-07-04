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

export function runKMeans(points: Point2D[], clusterCount: number, iterations = 80): ClusterResult {
  const n = points.length;
  if (n < 2) throw new Error("Se necesitan al menos 2 puntos para K-means.");

  const k = Math.max(2, Math.min(Math.floor(clusterCount), n));
  const sorted = [...points].sort((a, b) => a.x - b.x);
  let centers = Array.from({ length: k }, (_, idx) => {
    const pos = Math.round(((idx + 0.5) / k) * (sorted.length - 1));
    return { x: sorted[pos].x, y: sorted[pos].y };
  });
  let labelsByIndex: ClusterLabel[] = new Array(n).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;

    labelsByIndex = points.map((point, pointIndex) => {
      let bestLabel = 0;
      let bestDistance = Infinity;
      centers.forEach((center, centerIndex) => {
        const distance = squaredDistanceToCenter(point, center);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestLabel = centerIndex;
        }
      });
      if (labelsByIndex[pointIndex] !== bestLabel) changed = true;
      return bestLabel;
    });

    centers = centers.map((center, centerIndex) => {
      const members = points.filter((_, pointIndex) => labelsByIndex[pointIndex] === centerIndex);
      if (!members.length) {
        const farthest = points
          .map((point) => ({ point, distance: Math.min(...centers.map((c) => squaredDistanceToCenter(point, c))) }))
          .sort((a, b) => b.distance - a.distance)[0]?.point;
        return farthest ? { x: farthest.x, y: farthest.y } : center;
      }
      return {
        x: members.reduce((sum, point) => sum + point.x, 0) / members.length,
        y: members.reduce((sum, point) => sum + point.y, 0) / members.length,
      };
    });

    if (!changed) break;
  }

  return summarize(points, labelsByIndex, "kmeans", {
    clusters: k,
    iterations,
    distance: "euclidean",
  });
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
