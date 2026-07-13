import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("dataset publico", () => {
  it("no contiene identificadores ni cuasi-identificadores excluidos", () => {
    const header = fs.readFileSync("public/data/openplay_consolidated.csv", "utf8").split(/\r?\n/, 1)[0].split(",");
    for (const forbidden of ["pid", "geo_area", "height", "weight", "ethnicity", "neuro_diagnosed"]) {
      expect(header).not.toContain(forbidden);
    }
    const dictionary = fs.readFileSync("public/data/openplay_data_dictionary.csv", "utf8").split(/\r?\n/).slice(1).map((line) => line.split(",", 1)[0]);
    expect(dictionary).not.toContain("pid");
    expect(dictionary).not.toContain("geo_area");
  });
});
