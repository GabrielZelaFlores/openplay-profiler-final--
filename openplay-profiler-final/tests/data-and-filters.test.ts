import { describe, expect, it } from "vitest";
import { computeStats, pearsonCorrelation, pearsonCorrelationFromRows } from "../lib/data-utils";
import { filterRows } from "../lib/filter-utils";

describe("estadisticas y filtros", () => {
  it("maneja constantes, faltantes y pocos pares", () => {
    expect(pearsonCorrelation([1, 1, 1], [1, 2, 3])).toBeNaN();
    expect(pearsonCorrelation([1], [2])).toBeNaN();
    expect(pearsonCorrelationFromRows([{ a: 1, b: 2 }, { a: null, b: 3 }, { a: 3, b: 6 }], "a", "b")).toBeCloseTo(1);
    const stats = computeStats("x", [{ x: 2 }, { x: 2 }, { x: null }]);
    expect(stats.std).toBe(0);
    expect(stats.missing).toBe(1);
  });

  it("combina rango, categoria, faltantes y seleccion", () => {
    const rows = [
      { record_id: 1, age: 20, group: "A" },
      { record_id: 2, age: 30, group: "A" },
      { record_id: 3, age: null, group: "A" },
      { record_id: 4, age: 25, group: "B" },
    ];
    const result = filterRows(rows, { age: { min: 21, max: 30, includeMissing: false }, group: { values: ["A"] } }, ["2", "4"]);
    expect(result.map((row) => row.record_id)).toEqual([2]);
  });
});
