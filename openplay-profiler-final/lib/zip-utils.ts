import JSZip from "jszip";
import pako from "pako";

export interface ExtractedFile {
  name: string;
  path: string;
  extension: "csv" | "csv.gz";
  size: number;
  content: string;
}

// ─── Extrae CSV y CSV.GZ de un ZIP ──────────────────────────────────────────
export async function extractZipFiles(
  file: File,
  onProgress?: (pct: number, name: string) => void
): Promise<ExtractedFile[]> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const entries = Object.entries(zip.files).filter(([, f]) => !f.dir);
  const results: ExtractedFile[] = [];
  let done = 0;

  for (const [path, zipFile] of entries) {
    const name = path.split("/").pop() ?? path;
    const lower = name.toLowerCase();

    onProgress?.(Math.round((done / entries.length) * 100), name);

    if (lower.endsWith(".csv.gz")) {
      try {
        const buf = await zipFile.async("uint8array");
        const text = pako.inflate(buf, { to: "string" });
        results.push({
          name,
          path,
          extension: "csv.gz",
          size: text.length,
          content: text,
        });
      } catch {
        console.warn(`No se pudo descomprimir: ${name}`);
      }
    } else if (lower.endsWith(".csv")) {
      try {
        const text = await zipFile.async("string");
        results.push({
          name,
          path,
          extension: "csv",
          size: text.length,
          content: text,
        });
      } catch {
        console.warn(`No se pudo leer: ${name}`);
      }
    }

    done++;
  }

  onProgress?.(100, "Listo");
  return results;
}
