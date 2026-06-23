import type { DataRow, ColumnStats, IndexGroup, DataValue } from "./store";

// ─── Tipo de columna ────────────────────────────────────────────────────────
export function detectType(values: DataValue[]): "numeric" | "categorical" {
  const nonNull = values.filter((v) => v !== null && v !== "" && v !== undefined);
  if (nonNull.length === 0) return "categorical";
  const numCount = nonNull.filter(
    (v) => !isNaN(parseFloat(String(v))) && isFinite(Number(v))
  ).length;
  return numCount / nonNull.length > 0.75 ? "numeric" : "categorical";
}

// ─── Estadísticas de columna ────────────────────────────────────────────────
export function computeStats(col: string, rows: DataRow[]): ColumnStats {
  const values = rows.map((r) => r[col]);
  const nonNull = values.filter((v) => v !== null && v !== "" && v !== undefined);
  const missing = values.length - nonNull.length;
  const unique = new Set(nonNull.map(String)).size;
  const type = detectType(values);

  // Frecuencia
  const freq: Record<string, number> = {};
  for (const v of nonNull) {
    const k = String(v);
    freq[k] = (freq[k] ?? 0) + 1;
  }
  const topValues = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({ value, count }));

  const entropy =
    nonNull.length > 0
      ? -Object.values(freq).reduce((acc, c) => {
          const p = c / nonNull.length;
          return acc + (p > 0 ? p * Math.log2(p) : 0);
        }, 0)
      : 0;

  const base: ColumnStats = {
    name: col,
    type,
    count: nonNull.length,
    missing,
    missingPct: values.length > 0 ? (missing / values.length) * 100 : 0,
    unique,
    mode: topValues[0]?.value,
    topValues,
    entropy,
  };

  if (type === "numeric") {
    const nums = nonNull
      .map((v) => parseFloat(String(v)))
      .filter((n) => !isNaN(n) && isFinite(n))
      .sort((a, b) => a - b);

    if (nums.length === 0) return base;
    const n = nums.length;
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);

    base.mean = mean;
    base.std = std;
    base.min = nums[0];
    base.max = nums[n - 1];
    base.median =
      n % 2 === 0 ? (nums[n / 2 - 1] + nums[n / 2]) / 2 : nums[Math.floor(n / 2)];
    base.q1 = nums[Math.floor(n * 0.25)];
    base.q3 = nums[Math.floor(n * 0.75)];
    base.iqr = (base.q3 ?? 0) - (base.q1 ?? 0);

    if (std > 0 && n > 2) {
      base.skewness = nums.reduce((a, b) => a + ((b - mean) / std) ** 3, 0) / n;
      base.kurtosis = nums.reduce((a, b) => a + ((b - mean) / std) ** 4, 0) / n - 3;
    }
  }

  return base;
}

// ─── Detección de grupos de índices ─────────────────────────────────────────
export function detectIndexGroups(columns: string[]): IndexGroup[] {
  const prefixMap: Record<string, string[]> = {};
  // Matches: gdt_1, bw_gdt_1, promis_2_panel, wemwbs_3, bangs_10, bfi_2_xs_1, trojan_5
  const itemRe = /^(?:bw_)?([a-z][a-z0-9_]*?)_(\d+)(?:_.*)?$/i;

  for (const col of columns) {
    const m = col.match(itemRe);
    if (!m) continue;
    const prefix = m[1].toLowerCase();
    // Skip prefixes that are too generic
    if (["has", "num", "intake", "daily", "bw"].includes(prefix)) continue;
    if (!prefixMap[prefix]) prefixMap[prefix] = [];
    if (!prefixMap[prefix].includes(col)) prefixMap[prefix].push(col);
  }

  const groups: IndexGroup[] = [];
  for (const [prefix, items] of Object.entries(prefixMap)) {
    if (items.length < 2) continue;
    const sorted = [...items].sort((a, b) => {
      const na = parseInt(a.match(/(\d+)/)?.[1] ?? "0");
      const nb = parseInt(b.match(/(\d+)/)?.[1] ?? "0");
      return na - nb;
    });
    const totalCol = columns.find(
      (c) =>
        c === `${prefix}_total` ||
        c === `bw_${prefix}_total` ||
        c === `${prefix}total`
    );
    groups.push({ name: prefix.toUpperCase(), items: sorted, totalCol });
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Correlaciones ──────────────────────────────────────────────────────────
export function pearsonCorrelation(x: number[], y: number[]): number {
  const pairs: [number, number][] = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (isFinite(x[i]) && isFinite(y[i])) pairs.push([x[i], y[i]]);
  }
  const n = pairs.length;
  if (n < 2) return NaN;
  const mx = pairs.reduce((a, p) => a + p[0], 0) / n;
  const my = pairs.reduce((a, p) => a + p[1], 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (const [xi, yi] of pairs) {
    num += (xi - mx) * (yi - my);
    dx += (xi - mx) ** 2;
    dy += (yi - my) ** 2;
  }
  if (dx === 0 || dy === 0) return NaN;
  return num / Math.sqrt(dx * dy);
}

export function getNumericPairs(
  rows: DataRow[],
  xCol: string,
  yCol: string
): [number, number][] {
  const pairs: [number, number][] = [];
  for (const row of rows) {
    const x = parseFloat(String(row[xCol] ?? ""));
    const y = parseFloat(String(row[yCol] ?? ""));
    if (isFinite(x) && isFinite(y)) pairs.push([x, y]);
  }
  return pairs;
}

export function pearsonCorrelationFromRows(
  rows: DataRow[],
  xCol: string,
  yCol: string
): number {
  const pairs = getNumericPairs(rows, xCol, yCol);
  return pearsonCorrelation(
    pairs.map(([x]) => x),
    pairs.map(([, y]) => y)
  );
}

// ─── Valores numéricos de una columna ───────────────────────────────────────
export function getNumericValues(rows: DataRow[], col: string): number[] {
  return rows
    .map((r) => parseFloat(String(r[col] ?? "")))
    .filter((n) => !isNaN(n) && isFinite(n));
}

// ─── Exportar CSV ───────────────────────────────────────────────────────────
export function rowsToCSV(rows: DataRow[], columns?: string[]): string {
  const cols = columns ?? (rows.length > 0 ? Object.keys(rows[0]) : []);
  const esc = (v: DataValue): string => {
    if (v === null || v === undefined || v === "") return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join(
    "\n"
  );
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Formateo ───────────────────────────────────────────────────────────────
export function fmt(n: number | undefined | null, dec = 2): string {
  if (n === null || n === undefined || isNaN(n)) return "–";
  return n.toFixed(dec);
}

export function fmtInt(n: number | undefined | null): string {
  if (n === null || n === undefined || isNaN(n)) return "–";
  return Math.round(n).toLocaleString("es");
}
