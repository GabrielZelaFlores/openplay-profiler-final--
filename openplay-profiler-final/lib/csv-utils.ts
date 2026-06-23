import Papa from "papaparse";
import pako from "pako";
import type { DataRow } from "./store";

export interface ParseResult {
  rows: DataRow[];
  columns: string[];
  totalRows: number;
}

// ─── CSV plano ──────────────────────────────────────────────────────────────
export function parseCSVText(text: string): ParseResult {
  const result = Papa.parse<DataRow>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  const parsedColumns = result.meta.fields ?? [];
  const columns = parsedColumns.includes("record_id")
    ? parsedColumns
    : ["record_id", ...parsedColumns];
  const rows = result.data.map((row, idx) => ({
    ...row,
    record_id: row["record_id"] ?? idx + 1,
  }));
  return { rows, columns, totalRows: rows.length };
}

// ─── CSV.GZ ─────────────────────────────────────────────────────────────────
export async function parseCSVGZ(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  const decompressed = pako.inflate(uint8, { to: "string" });
  return parseCSVText(decompressed);
}

// ─── CSV plano desde File ────────────────────────────────────────────────────
export function parseCSVFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<DataRow>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsedColumns = result.meta.fields ?? [];
        const columns = parsedColumns.includes("record_id")
          ? parsedColumns
          : ["record_id", ...parsedColumns];
        const rows = result.data.map((row, idx) => ({
          ...row,
          record_id: row["record_id"] ?? idx + 1,
        }));
        resolve({ rows, columns, totalRows: rows.length });
      },
      error: reject,
    });
  });
}

// ─── Detectar tipo de archivo ────────────────────────────────────────────────
export function detectFileType(name: string): "zip" | "csv.gz" | "csv" | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".csv.gz")) return "csv.gz";
  if (lower.endsWith(".csv")) return "csv";
  return null;
}
