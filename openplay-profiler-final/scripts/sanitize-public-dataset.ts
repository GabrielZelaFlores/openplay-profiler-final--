import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

const ROOT = process.cwd();
const input = path.join(ROOT, "public", "data", "openplay_consolidated.csv");
const output = path.join(ROOT, "public", "data", "openplay_consolidated.csv");
const dictionaryPath = path.join(ROOT, "public", "data", "openplay_data_dictionary.csv");
const reportPath = path.join(ROOT, "public", "data", "openplay_integration_report.json");

const REMOVED_COLUMNS = new Set([
  "pid", "geo_area", "height", "weight", "ethnicity", "edu_level",
  "employment", "marital_status", "dependents", "cohort",
  "neuro_identify", "neuro_diagnosed", "neuro_diag_asd",
  "neuro_diag_adhd", "neuro_diag_dyslexia",
]);

function main() {
  const parsed = Papa.parse<Record<string, string>>(fs.readFileSync(input, "utf8"), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);

  const fields = (parsed.meta.fields ?? []).filter((field) => !REMOVED_COLUMNS.has(field));
  const categorical = ["gender", "country"];
  const counts = new Map<string, Map<string, number>>();
  for (const field of categorical) counts.set(field, new Map());
  for (const row of parsed.data) {
    for (const field of categorical) {
      const value = row[field]?.trim();
      if (!value) continue;
      const bucket = counts.get(field)!;
      bucket.set(value, (bucket.get(value) ?? 0) + 1);
    }
  }

  const sanitized = parsed.data.map((row, index) => {
    const next: Record<string, string | number> = {};
    for (const field of fields) {
      if (field === "record_id") {
        next[field] = index + 1;
      } else if (field === "age") {
        const age = Number(row[field]);
        next[field] = Number.isFinite(age) ? Math.round(age / 5) * 5 : "";
      } else if (categorical.includes(field)) {
        const value = row[field]?.trim() ?? "";
        next[field] = value && (counts.get(field)?.get(value) ?? 0) < 10 ? "Other" : value;
      } else {
        next[field] = row[field] ?? "";
      }
    }
    return next;
  });

  fs.writeFileSync(output, Papa.unparse(sanitized, { columns: fields, newline: "\n" }), "utf8");
  if (fs.existsSync(dictionaryPath)) {
    const dictionary = Papa.parse<Record<string, string>>(fs.readFileSync(dictionaryPath, "utf8"), {
      header: true, skipEmptyLines: true,
    });
    const rows = dictionary.data.filter((row) => !REMOVED_COLUMNS.has(row.variable));
    fs.writeFileSync(dictionaryPath, Papa.unparse(rows, { newline: "\n" }), "utf8");
  }
  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    report.finalColumns = fields.length;
    report.publicRelease = {
      minimized: true,
      directIdentifiersRemoved: true,
      ageGeneralizationYears: 5,
      rareCategoryThreshold: 10,
      policy: "docs/PRIVACY.md",
    };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  console.log(`Public dataset sanitized: ${sanitized.length} rows, ${fields.length} columns.`);
  console.log(`Removed: ${[...REMOVED_COLUMNS].join(", ")}`);
}

main();
