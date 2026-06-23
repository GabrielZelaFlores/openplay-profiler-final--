"use client";
import { FileText, Download } from "lucide-react";

export default function IntroductionAttachment() {
  return (
    <div className="bg-white border border-orange-100 rounded p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FileText size={15} className="text-orange-500" /> Informe del proyecto
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            PDF final del informe: introduccion, vector de caracteristicas, metodologia visual,
            resultados de clustering e interpretacion de perfiles exploratorios.
          </p>
        </div>
        <a
          href="/docs/informe-openplay-profiler.pdf"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          <Download size={13} /> Abrir informe
        </a>
      </div>
    </div>
  );
}
