"use client";
import { useStore } from "@/lib/store";
import { FileText, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";

export default function ZipContentsPreview() {
  const { sourceFiles, integrationReport, sourceType } = useStore();

  if (!sourceFiles.length) return null;

  const report = integrationReport as {
    filesUsed?: string[];
    filesNotUsed?: string[];
    warnings?: string[];
    rowsPerSource?: Record<string, number>;
    participantsDetected?: number;
    finalRows?: number;
    finalColumns?: number;
    aggregations?: Record<string, string>;
    joinKeys?: Record<string, string>;
  } | null;

  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <FileText size={15} className="text-orange-500" />
        {sourceType === "zip" ? "Archivos detectados en el ZIP" : "Fuente de datos"}
      </h2>

      {/* Lista de archivos */}
      <div className="space-y-1 mb-4">
        {sourceFiles.map((f) => {
          const used = report?.filesUsed?.includes(f);
          const rows = report?.rowsPerSource?.[f];
          return (
            <div key={f} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                {used !== undefined ? (
                  used ? <CheckCircle size={13} className="text-green-500 shrink-0" /> : <XCircle size={13} className="text-gray-400 shrink-0" />
                ) : <Info size={13} className="text-gray-400 shrink-0" />}
                <span className={used ? "text-gray-700" : "text-gray-400"}>{f}</span>
              </div>
              {rows !== undefined && (
                <span className="text-gray-400">{rows.toLocaleString("es")} filas</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Reporte de integración */}
      {report && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-400">Clave de unión</div>
              <div className="font-medium text-gray-700">{report.joinKeys?.primary ?? "pid"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-400">Participantes calificados</div>
              <div className="font-medium text-gray-700">{report.finalRows?.toLocaleString("es") ?? "–"}</div>
            </div>
          </div>

          {/* Advertencias */}
          {report.warnings && report.warnings.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <AlertTriangle size={12} className="text-yellow-500" /> Advertencias
              </div>
              <div className="space-y-1">
                {report.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">{w}</div>
                ))}
              </div>
            </div>
          )}

          {/* Agregaciones */}
          {report.aggregations && Object.keys(report.aggregations).length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Agregaciones realizadas</div>
              <div className="space-y-1">
                {Object.entries(report.aggregations).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs">
                    <span className="text-gray-400 shrink-0">{k}:</span>
                    <span className="text-gray-600">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
