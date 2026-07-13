import { describe, expect, it } from "vitest";
import { consolidateOpenPlayData } from "../lib/openplay-integration";
import type { ExtractedFile } from "../lib/zip-utils";

const file = (name: string, content: string): ExtractedFile => ({ name, path: name, extension: "csv.gz", size: content.length, content });

describe("integracion por pid", () => {
  it("conserva calificados y solo une fuentes con pid coincidente", async () => {
    const result = await consolidateOpenPlayData([
      file("survey_intake_raw.csv.gz", "pid,qualified,age,gender,country\np1,TRUE,20,Woman,PE\np2,FALSE,30,Man,US\np3,1,40,Man,PE"),
      file("survey_daily_raw.csv.gz", "pid,played_games,stress\np1,1,1\np1,0,1\np2,1,1\nmissing,1,1"),
    ]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.pid)).toEqual(["p1", "p3"]);
    expect(result.rows[0].daily_num_responses).toBe(2);
    expect(result.rows[1].daily_num_responses).toBeUndefined();
  });
});
