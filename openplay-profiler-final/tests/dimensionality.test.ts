import { describe, expect, it } from "vitest";
import { imputeMatrix, runPCA, standardizeMatrix } from "../lib/dimensionality-utils";

describe("preprocesamiento dimensional", () => {
  it("imputa una columna totalmente vacia sin producir NaN", () => {
    const result = imputeMatrix([[NaN, 1], [NaN, 3]], "mean");
    expect(result.matrix).toEqual([[0, 1], [0, 3]]);
    expect(standardizeMatrix(result.matrix).flat().every(Number.isFinite)).toBe(true);
  });

  it("PCA coincide con la solucion analitica de dos variables colineales", () => {
    const rows = [1, 2, 3, 4].map((x) => ({ record_id: x, a: x, b: 2 * x }));
    const result = runPCA(rows, ["a", "b"]);
    expect(result.metadata.explainedVariance[0]).toBeCloseTo(1, 8);
    expect(result.metadata.explainedVariance[1]).toBeCloseTo(0, 8);
    expect(Math.abs(result.metadata.loadings.PC1[0])).toBeCloseTo(Math.SQRT1_2, 5);
    expect(Math.abs(result.metadata.loadings.PC1[1])).toBeCloseTo(Math.SQRT1_2, 5);
  });
});
