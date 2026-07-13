import type { ActiveFilter, DataRow, DataValue } from "./store";

function finiteNumber(value: DataValue): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (value === null || value === "") return NaN;
  const number = Number(String(value).trim());
  return Number.isFinite(number) ? number : NaN;
}

export function matchesFilters(row: DataRow, filters: Record<string, ActiveFilter>): boolean {
  for (const [column, filter] of Object.entries(filters)) {
    const value = row[column];
    const missing = value === null || value === undefined || value === "";
    if (filter.min !== undefined || filter.max !== undefined) {
      if (missing) {
        if (filter.includeMissing === false) return false;
        continue;
      }
      const number = finiteNumber(value);
      if (!Number.isFinite(number)) {
        if (filter.includeMissing === false) return false;
        continue;
      }
      if (filter.min !== undefined && number < filter.min) return false;
      if (filter.max !== undefined && number > filter.max) return false;
    }
    if (filter.values?.length && !filter.values.includes(String(value ?? ""))) return false;
  }
  return true;
}

export function filterRows(
  rows: DataRow[],
  filters: Record<string, ActiveFilter>,
  selectedRecordIds: string[] = []
): DataRow[] {
  const selected = new Set(selectedRecordIds.map(String));
  return rows.filter((row) =>
    (!selected.size || selected.has(String(row.record_id))) && matchesFilters(row, filters)
  );
}
