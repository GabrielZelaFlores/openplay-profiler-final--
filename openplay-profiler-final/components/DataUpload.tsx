"use client";
import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText, Package, Download, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { detectFileType, parseCSVText, parseCSVGZ } from "@/lib/csv-utils";
import { extractZipFiles } from "@/lib/zip-utils";
import { consolidateOpenPlayData } from "@/lib/openplay-integration";
import { computeStats, detectIndexGroups, rowsToCSV, downloadCSV } from "@/lib/data-utils";

export default function DataUpload() {
  const { setDataset, setLoading, isLoading, loadingMessage, rows, fileName, totalRows, totalColumns, sourceFiles, reset } = useStore();
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setProgress(0);
    const type = detectFileType(file.name);
    if (!type) { setError("Formato no soportado. Usa .zip, .csv o .csv.gz"); return; }

    setLoading(true, "Cargando archivo…");

    try {
      if (type === "zip") {
        setProgressMsg("Extrayendo archivos del ZIP…");
        const files = await extractZipFiles(file, (pct, name) => {
          setProgress(pct * 0.4);
          setProgressMsg(`Extrayendo: ${name}`);
        });

        setProgressMsg("Consolidando datos…");
        const result = await consolidateOpenPlayData(files, (msg) => {
          setProgress((p) => Math.min(95, p + 1));
          setProgressMsg(msg);
        });

        setProgressMsg("Calculando estadísticas…");
        const columnStats: Record<string, ReturnType<typeof computeStats>> = {};
        for (const col of result.columns) {
          columnStats[col] = computeStats(col, result.rows);
        }
        const indexGroups = detectIndexGroups(result.columns);

        setDataset({
          rows: result.rows,
          columns: result.columns,
          fileName: file.name,
          totalRows: result.rows.length,
          totalColumns: result.columns.length,
          sourceType: "zip",
          sourceFiles: files.map((f) => f.name),
          columnStats,
          indexGroups,
          filteredRows: result.rows,
          integrationReport: result.report as unknown as Record<string, unknown>,
        });
        setProgress(100);
        setProgressMsg("¡Listo!");

      } else if (type === "csv.gz") {
        setProgressMsg("Descomprimiendo…");
        setProgress(30);
        const result = await parseCSVGZ(file);
        setProgress(70);
        setProgressMsg("Calculando estadísticas…");
        const columnStats: Record<string, ReturnType<typeof computeStats>> = {};
        for (const col of result.columns) columnStats[col] = computeStats(col, result.rows);
        const indexGroups = detectIndexGroups(result.columns);
        setDataset({
          rows: result.rows, columns: result.columns, fileName: file.name,
          totalRows: result.totalRows, totalColumns: result.columns.length,
          sourceType: "csv.gz", sourceFiles: [file.name], columnStats, indexGroups,
          filteredRows: result.rows,
        });
        setProgress(100);

      } else {
        setProgressMsg("Parseando CSV…");
        setProgress(30);
        const result = await new Promise<ReturnType<typeof parseCSVText>>((res) => {
          const reader = new FileReader();
          reader.onload = (e) => res(parseCSVText(e.target!.result as string));
          reader.readAsText(file);
        });
        setProgress(70);
        setProgressMsg("Calculando estadísticas…");
        const columnStats: Record<string, ReturnType<typeof computeStats>> = {};
        for (const col of result.columns) columnStats[col] = computeStats(col, result.rows);
        const indexGroups = detectIndexGroups(result.columns);
        setDataset({
          rows: result.rows, columns: result.columns, fileName: file.name,
          totalRows: result.totalRows, totalColumns: result.columns.length,
          sourceType: "csv", sourceFiles: [file.name], columnStats, indexGroups,
          filteredRows: result.rows,
        });
        setProgress(100);
      }
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [setDataset, setLoading]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleExportCSV = () => {
    if (!rows.length) return;
    const csv = rowsToCSV(rows);
    downloadCSV(csv, "openplay_profiling_processed.csv");
  };

  // Si ya hay datos cargados, mostrar resumen
  if (rows.length > 0) {
    return (
      <div className="bg-white border border-gray-200 rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-orange-500" />
            <span className="font-medium text-gray-800 text-sm">{fileName}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              <Download size={13} /> Descargar CSV
            </button>
            <button
              onClick={() => { reset(); if (inputRef.current) inputRef.current.value = ""; }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
            >
              <RefreshCw size={13} /> Reemplazar
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-orange-50 border border-orange-200 rounded p-2 text-center">
            <div className="font-bold text-orange-700 text-lg">{totalRows.toLocaleString("es")}</div>
            <div className="text-gray-500">participantes</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded p-2 text-center">
            <div className="font-bold text-orange-700 text-lg">{totalColumns}</div>
            <div className="text-gray-500">variables</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded p-2 text-center">
            <div className="font-bold text-orange-700 text-lg">{sourceFiles.length}</div>
            <div className="text-gray-500">fuentes</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <Upload size={15} className="text-orange-500" /> Cargar datos
      </h2>

      {/* Auto-load del CSV precompilado */}
      <button
        onClick={async () => {
          setLoading(true, "Cargando CSV consolidado…");
          setProgressMsg("Descargando openplay_consolidated.csv…");
          try {
            const res = await fetch("/data/openplay_consolidated.csv");
            if (!res.ok) throw new Error("No se encontró /data/openplay_consolidated.csv");
            const text = await res.text();
            setProgressMsg("Parseando…");
            const result = parseCSVText(text);
            setProgressMsg("Calculando estadísticas…");
            const columnStats: Record<string, ReturnType<typeof computeStats>> = {};
            for (const col of result.columns) columnStats[col] = computeStats(col, result.rows);
            const indexGroups = detectIndexGroups(result.columns);
            setDataset({
              rows: result.rows, columns: result.columns, fileName: "openplay_consolidated.csv",
              totalRows: result.totalRows, totalColumns: result.columns.length,
              sourceType: "csv", sourceFiles: ["openplay_consolidated.csv"], columnStats, indexGroups,
              filteredRows: result.rows,
            });
          } catch (e) {
            setError(`${e instanceof Error ? e.message : String(e)}`);
          } finally {
            setLoading(false);
          }
        }}
        className="w-full mb-3 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 font-medium"
      >
        Cargar openplay_consolidated.csv (precompilado)
      </button>

      <div className="text-xs text-gray-400 text-center mb-3">— o cargar archivo —</div>

      {/* Área drag & drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded p-6 text-center cursor-pointer transition-colors ${
          dragOver ? "border-orange-400 bg-orange-50" : "border-gray-300 hover:border-orange-300"
        }`}
      >
        <Package size={28} className="mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600">Arrastra aquí o haz clic para seleccionar</p>
        <p className="text-xs text-gray-400 mt-1">.zip · .csv · .csv.gz</p>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.csv,.gz"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
        />
      </div>

      {/* Progreso */}
      {isLoading && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{progressMsg || loadingMessage}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
          <X size={13} /> {error}
        </div>
      )}
    </div>
  );
}
