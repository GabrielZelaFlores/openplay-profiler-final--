"use client";
import { useStore } from "@/lib/store";
import type { DashboardTab } from "@/lib/store";
import DataUpload from "@/components/DataUpload";
import ZipContentsPreview from "@/components/ZipContentsPreview";
import DatasetPreview from "@/components/DatasetPreview";
import IntroductionAttachment from "@/components/IntroductionAttachment";
import DataMiningOverview from "@/components/DataMiningOverview";
import ProfilingPanel from "@/components/ProfilingPanel";
import CorrelationHeatmap from "@/components/CorrelationHeatmap";
import InteractivePlot from "@/components/InteractivePlot";
import IndexDecomposition from "@/components/IndexDecomposition";
import FeatureVectorBuilder from "@/components/FeatureVectorBuilder";
import FeatureVectorEvaluation from "@/components/FeatureVectorEvaluation";
import FiltersPanel from "@/components/FiltersPanel";
import DimensionalityReduction from "@/components/DimensionalityReduction";
import VisualRecommendations from "@/components/VisualRecommendations";
import CaseStudiesValidation from "@/components/CaseStudiesValidation";
import { Database, BarChart2, Filter, Activity, BookOpen, GitBranch, TrendingUp, ShieldCheck } from "lucide-react";

const TABS: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
  { id: "datos",    label: "Datos",           icon: <Database size={14} /> },
  { id: "profiling",label: "Profiling",        icon: <BarChart2 size={14} /> },
  { id: "bivariado",label: "Bivariado",         icon: <TrendingUp size={14} /> },
  { id: "encuestas",label: "Encuestas",         icon: <BookOpen size={14} /> },
  { id: "vector",   label: "Vector",            icon: <GitBranch size={14} /> },
  { id: "filtros",  label: "Filtros",           icon: <Filter size={14} /> },
  { id: "reduccion",label: "PCA / t-SNE / UMAP",icon: <Activity size={14} /> },
  { id: "validacion",label: "Validacion",       icon: <ShieldCheck size={14} /> },
];

function ParticipantModal() {
  const { selectedParticipant, setSelectedParticipant } = useStore();
  if (!selectedParticipant) return null;

  const sections: { label: string; keys: string[] }[] = [
    { label: "Identificación anonimizada", keys: ["record_id","age","gender","country"] },
    { label: "Demografía minimizada", keys: ["num_platforms"] },
    { label: "GDT", keys: ["bw_gdt_1","bw_gdt_2","bw_gdt_3","bw_gdt_4","gdt_total"] },
    { label: "PROMIS", keys: ["bw_promis_1","bw_promis_2","bw_promis_3","bw_promis_4","bw_promis_5","bw_promis_6","bw_promis_7","bw_promis_8","promis_total"] },
    { label: "WEMWBS", keys: ["bw_wemwbs_1","bw_wemwbs_2","bw_wemwbs_3","bw_wemwbs_4","bw_wemwbs_5","bw_wemwbs_6","bw_wemwbs_7","wemwbs_total"] },
    { label: "BANGS", keys: Array.from({length:18}, (_,i) => `bw_bangs_${i+1}`).concat(["bangs_total"]) },
    { label: "Telemetria derivada", keys: ["telem_nocturnal_sessions","telem_activity_count","telem_total_sessions"] },
    { label: "Steam", keys: ["steam_total_records","steam_unique_games","steam_playtime_2weeks_min","steam_playtime_2weeks_max","steam_playtime_forever_max","steam_owned_games_count","steam_linked"] },
    { label: "Xbox", keys: ["xbox_total_sessions","xbox_total_duration_min","xbox_mean_session_min","xbox_nocturnal_sessions","xbox_unique_games"] },
    { label: "Nintendo", keys: ["nintendo_total_sessions","nintendo_total_duration_min","nintendo_mean_session_min","nintendo_nocturnal_sessions","nintendo_unique_games"] },
    { label: "Android / iOS", keys: ["android_total_minutes","android_mean_daily_minutes","ios_total_minutes","ios_mean_daily_minutes"] },
    { label: "Cognitivo", keys: ["cog_mean_rt","cog_mean_accuracy","cog_num_tasks","cog_num_trials"] },
    { label: "Tiempo", keys: ["timeuse_num_entries","timeuse_num_days","timeuse_gaming_entries"] },
    { label: "Disponibilidad", keys: ["has_biweekly","has_steam","has_xbox","has_nintendo","has_android","has_ios","has_cognitive","num_telemetry_platforms"] },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedParticipant(null)}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h3 className="font-semibold text-gray-800">Perfil del participante</h3>
            <div className="text-xs text-gray-500">record_id anonimizado: {selectedParticipant["record_id"]}</div>
          </div>
          <button onClick={() => setSelectedParticipant(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-4">
          {sections.map((sec) => {
            const rows = sec.keys.filter((k) => selectedParticipant[k] !== null && selectedParticipant[k] !== undefined && selectedParticipant[k] !== "");
            if (rows.length === 0) return null;
            return (
              <div key={sec.label}>
                <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">{sec.label}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {rows.map((k) => (
                    <div key={k} className="flex justify-between text-xs py-0.5 border-b border-gray-50">
                      <span className="text-gray-500 truncate">{k}</span>
                      <span className="font-mono text-gray-700 ml-2">{String(selectedParticipant[k])}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { rows, selectedVariables, activeTab, setActiveTab } = useStore();
  const hasData = rows.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-orange-500 rounded flex items-center justify-center font-bold text-sm">OP</div>
          <div>
            <div className="font-semibold text-sm">OpenPlay Profiler</div>
            <div className="text-xs text-gray-400">Análisis visual de datos de videojuegos y bienestar</div>
          </div>
        </div>
        {hasData && (
          <div className="text-xs text-gray-400">
            {rows.length.toLocaleString("es")} participantes · {selectedVariables.length} variables seleccionadas
          </div>
        )}
      </header>

      {/* Tabs (solo si hay datos) */}
      {hasData && (
        <nav className="bg-white border-b border-gray-200 px-6 flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      )}

      {/* Contenido */}
      <main className="flex-1 p-6 max-w-screen-xl mx-auto w-full">

        {/* TAB: DATOS (siempre visible) */}
        {(!hasData || activeTab === "datos") && (
          <div className="space-y-4">
            <IntroductionAttachment />
            <DataUpload />
            {hasData && (
              <>
                <ZipContentsPreview />
                <DataMiningOverview />
                <DatasetPreview />
              </>
            )}
          </div>
        )}

        {/* TAB: PROFILING */}
        {hasData && activeTab === "profiling" && (
          <ProfilingPanel />
        )}

        {/* TAB: BIVARIADO */}
        {hasData && activeTab === "bivariado" && (
          <InteractivePlot />
        )}

        {/* TAB: ENCUESTAS */}
        {hasData && activeTab === "encuestas" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <IndexDecomposition />
            <CorrelationHeatmap />
          </div>
        )}

        {/* TAB: VECTOR */}
        {hasData && activeTab === "vector" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <FeatureVectorBuilder />
              <FeatureVectorEvaluation />
              <VisualRecommendations />
            </div>
            <CorrelationHeatmap />
          </div>
        )}

        {/* TAB: FILTROS */}
        {hasData && activeTab === "filtros" && (
          <FiltersPanel />
        )}

        {/* TAB: REDUCCIÓN */}
        {hasData && activeTab === "reduccion" && (
          <DimensionalityReduction />
        )}

        {/* TAB: VALIDACION */}
        {hasData && activeTab === "validacion" && (
          <CaseStudiesValidation />
        )}
      </main>

      {/* Modal participante */}
      <ParticipantModal />

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-2 text-xs text-gray-400 text-center">
        OpenPlay Profiler · Dataset real de OpenPlay · Ninguna variable es eliminada automáticamente por correlación
      </footer>
    </div>
  );
}
