"use client";
import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { useStore } from "@/lib/store";

export default function VisualRecommendations() {
  const { selectedVariables, columnStats } = useStore();

  const recommendations = useMemo(() => {
    const numeric = selectedVariables.filter((v) => columnStats[v]?.type === "numeric");
    const categorical = selectedVariables.filter((v) => columnStats[v]?.type === "categorical");
    const recs: { title: string; detail: string }[] = [];

    if (selectedVariables.length === 0) {
      recs.push({
        title: "Seleccionar vector integral",
        detail: "Usa el vector recomendado: combina bienestar, riesgo de juego problematico, telemetria, actividad diaria, cognicion y uso del tiempo.",
      });
      recs.push({
        title: "Flujo sugerido",
        detail: "Carga datos, evalua el vector, ejecuta PCA/UMAP/t-SNE y aplica clustering sobre la proyeccion 2D.",
      });
      return recs;
    }
    if (numeric.length === 1) {
      recs.push({
        title: "Profiling univariado",
        detail: `Revisar histograma, boxplot y valores extremos de ${numeric[0]}.`,
      });
    }
    if (numeric.length === 2) {
      recs.push({
        title: "Comparacion bivariada",
        detail: `Cruzar ${numeric[0]} contra ${numeric[1]} y revisar correlacion de Pearson.`,
      });
    }
    if (numeric.length >= 3) {
      recs.push({
        title: "Heatmap de correlaciones",
        detail: "Detectar variables redundantes o pares con correlacion alta.",
      });
      recs.push({
        title: "PCA / t-SNE / UMAP",
        detail: "Proyectar el vector para buscar grupos, outliers y puntos cercanos/lejanos.",
      });
      recs.push({
        title: "Clustering 2D",
        detail: "Despues de generar la proyeccion, usa jerarquico o DBSCAN para colorear grupos y evaluar su interpretabilidad.",
      });
    }
    if (categorical.length > 0 && numeric.length > 0) {
      recs.push({
        title: "Filtro por categoria",
        detail: `Filtrar por ${categorical[0]} y comparar distribuciones de las variables numericas.`,
      });
    }
    return recs;
  }, [selectedVariables, columnStats]);

  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <Lightbulb size={15} className="text-orange-500" /> Recomendaciones visuales
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Guia de diseno analitico: cada recomendacion indica que vista conviene usar y como defenderla en el informe.
      </p>
      <div className="space-y-2">
        {recommendations.map((rec) => (
          <div key={rec.title} className="border border-orange-100 bg-orange-50 rounded p-2">
            <div className="text-xs font-semibold text-orange-800">{rec.title}</div>
            <div className="text-xs text-gray-600 mt-0.5">{rec.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
