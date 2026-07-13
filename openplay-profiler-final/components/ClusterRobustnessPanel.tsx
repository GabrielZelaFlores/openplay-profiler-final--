"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { DataRow } from "@/lib/store";
import type { ClusterResult } from "@/lib/clustering-utils";
import { adjustedRandIndex } from "@/lib/clustering-utils";
import { assessOriginalSpaceInWorker } from "@/lib/analytics-worker-client";

export default function ClusterRobustnessPanel({
  rows, variables, impute, clusterCount, projected,
}: {
  rows: DataRow[];
  variables: string[];
  impute: "mean" | "median" | "zero" | "drop";
  clusterCount: number;
  projected: ClusterResult | null;
}) {
  const [result, setResult] = useState<{ mean: number; min: number; agreement: number | null } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true); setError(null);
    try {
      const original = await assessOriginalSpaceInWorker(rows, variables, impute, clusterCount);
      const agreementLabels = projected
        ? original.recordIds.map((id) => projected.labels[id]).filter((label): label is number => label !== undefined)
        : [];
      const originalAligned = projected
        ? original.labels.filter((_, index) => projected.labels[original.recordIds[index]] !== undefined)
        : [];
      setResult({
        mean: original.stability.meanAdjustedRand,
        min: original.stability.minAdjustedRand,
        agreement: agreementLabels.length > 1 ? adjustedRandIndex(originalAligned, agreementLabels) : null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setRunning(false); }
  };

  return (
    <section className="bg-white border border-gray-200 rounded p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><ShieldCheck size={15} /> Robustez del clustering</h3>
          <p className="text-xs text-gray-500 mt-1">Compara ocho inicializaciones en el espacio original estandarizado y, si existe, contra el clustering 2D.</p>
        </div>
        <button onClick={run} disabled={running || variables.length < 2} className="px-3 py-1.5 text-xs bg-gray-800 text-white rounded disabled:opacity-40">
          {running ? "Evaluando..." : "Evaluar estabilidad"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {result && <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        <Metric label="ARI medio" value={result.mean} />
        <Metric label="ARI minimo" value={result.min} />
        <Metric label="Acuerdo original / 2D" value={result.agreement} />
      </div>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return <div className="bg-gray-50 border rounded p-2"><div className="text-gray-500">{label}</div><div className="font-semibold text-gray-800">{value === null ? "--" : value.toFixed(3)}</div></div>;
}
