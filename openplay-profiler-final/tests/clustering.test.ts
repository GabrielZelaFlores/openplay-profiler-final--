import { describe, expect, it } from "vitest";
import { runDBSCAN, runHierarchicalSingleLink, runKMeansVectors } from "../lib/clustering-utils";

const points = [
  { record_id: 1, x: 0, y: 0 }, { record_id: 2, x: 0.1, y: 0 },
  { record_id: 3, x: 10, y: 10 }, { record_id: 4, x: 10.1, y: 10 },
];

describe("clustering", () => {
  it("K-means converge, es reproducible y no deja clusters vacios", () => {
    const vectors = points.map(({ x, y }) => [x, y]);
    const a = runKMeansVectors(vectors, 3, 100, 7);
    const b = runKMeansVectors(vectors, 3, 100, 7);
    expect(a.labels).toEqual(b.labels);
    expect(new Set(a.labels).size).toBe(3);
    expect(a.iterationsRun).toBeLessThanOrEqual(100);
  });

  it("DBSCAN distingue nucleos, frontera y ruido", () => {
    const data = [...points.slice(0, 2), { record_id: 5, x: 0.2, y: 0 }, { record_id: 6, x: 4, y: 4 }];
    const result = runDBSCAN(data, 0.15, 2);
    expect(result.noiseCount).toBe(1);
    expect(result.clusters.find((cluster) => cluster.label === 0)?.count).toBe(3);
  });

  it("DBSCAN con radio cero solo une duplicados", () => {
    const result = runDBSCAN([{ record_id: 1, x: 1, y: 1 }, { record_id: 2, x: 1, y: 1 }, { record_id: 3, x: 2, y: 2 }], 0, 2);
    expect(result.noiseCount).toBe(1);
  });

  it("jerarquico devuelve exactamente el numero solicitado de grupos", () => {
    expect(runHierarchicalSingleLink(points, 2).clusters.filter((c) => c.label !== -1)).toHaveLength(2);
  });
});
