import { create } from "zustand";
import { filterRows } from "./filter-utils";
import type { AnalysisRun } from "./openplay-analysis";

export type DataValue = string | number | boolean | null;
export type DataRow = Record<string, DataValue>;

export interface ColumnStats {
  name: string;
  type: "numeric" | "categorical";
  count: number;
  missing: number;
  missingPct: number;
  unique: number;
  mean?: number;
  median?: number;
  std?: number;
  min?: number;
  max?: number;
  q1?: number;
  q3?: number;
  iqr?: number;
  skewness?: number;
  kurtosis?: number;
  entropy?: number;
  mode?: string;
  topValues?: { value: string; count: number }[];
  sourceFile?: string;
}

export interface IndexGroup {
  name: string;
  items: string[];
  totalCol?: string;
}

export interface DimResult {
  method: "pca" | "tsne" | "umap";
  coordinates: { record_id: DataValue; x: number; y: number }[];
  metadata: {
    rowsUsed: number;
    rowsExcluded: number;
    variablesUsed: string[];
    explainedVariance?: number[];
    loadings?: Record<string, number[]>;
  };
}

export interface ActiveFilter {
  min?: number;
  max?: number;
  values?: string[];
  includeMissing?: boolean;
}

export type DashboardTab = "datos" | "profiling" | "bivariado" | "encuestas" | "vector" | "filtros" | "reduccion" | "validacion";

interface StoreState {
  // Dataset
  rows: DataRow[];
  columns: string[];
  fileName: string;
  totalRows: number;
  totalColumns: number;
  sourceType: "zip" | "csv" | "csv.gz" | null;
  sourceFiles: string[];
  columnStats: Record<string, ColumnStats>;
  indexGroups: IndexGroup[];
  integrationReport: Record<string, unknown> | null;

  // Analysis state
  selectedVariables: string[];
  activeFilters: Record<string, ActiveFilter>;
  selectedRecordIds: string[];
  filteredRows: DataRow[];
  dimResults: DimResult[];
  selectedParticipant: DataRow | null;
  analysisRun: AnalysisRun | null;
  activeTab: DashboardTab;
  profilingVariable: string | null;
  bivariatePreset: { x: string; y: string; color: string } | null;

  // Loading state
  isLoading: boolean;
  loadingMessage: string;

  // Actions
  setDataset: (data: Partial<StoreState>) => void;
  toggleVariable: (col: string) => void;
  clearVariables: () => void;
  selectGroup: (group: IndexGroup) => void;
  setFilter: (col: string, filter: ActiveFilter | null) => void;
  clearFilters: () => void;
  applyFilters: () => void;
  setSelectedRecordIds: (ids: string[]) => void;
  clearSelectedRecordIds: () => void;
  addDimResult: (result: DimResult) => void;
  setAnalysisRun: (run: AnalysisRun | null) => void;
  setActiveTab: (tab: DashboardTab) => void;
  openProfiling: (column: string) => void;
  openBivariate: (x: string, y: string, color?: string) => void;
  setSelectedParticipant: (row: DataRow | null) => void;
  setLoading: (loading: boolean, message?: string) => void;
  reset: () => void;
}

const initialState = {
  rows: [] as DataRow[],
  columns: [] as string[],
  fileName: "",
  totalRows: 0,
  totalColumns: 0,
  sourceType: null as null,
  sourceFiles: [] as string[],
  columnStats: {} as Record<string, ColumnStats>,
  indexGroups: [] as IndexGroup[],
  integrationReport: null,
  selectedVariables: [] as string[],
  activeFilters: {} as Record<string, ActiveFilter>,
  selectedRecordIds: [] as string[],
  filteredRows: [] as DataRow[],
  dimResults: [] as DimResult[],
  selectedParticipant: null as DataRow | null,
  analysisRun: null as AnalysisRun | null,
  activeTab: "datos" as DashboardTab,
  profilingVariable: null as string | null,
  bivariatePreset: null as { x: string; y: string; color: string } | null,
  isLoading: false,
  loadingMessage: "",
};

export const useStore = create<StoreState>((set, get) => ({
  ...initialState,

  setDataset: (data) => set((s) => ({
    ...s,
    ...data,
    selectedVariables: [],
    activeFilters: {},
    selectedRecordIds: [],
    dimResults: [],
    selectedParticipant: null,
    analysisRun: null,
    activeTab: "datos",
    profilingVariable: null,
    bivariatePreset: null,
  })),

  toggleVariable: (col) =>
    set((s) => ({
      selectedVariables: s.selectedVariables.includes(col)
        ? s.selectedVariables.filter((v) => v !== col)
        : [...s.selectedVariables, col],
      dimResults: [],
      analysisRun: null,
    })),

  clearVariables: () => set({ selectedVariables: [], dimResults: [], analysisRun: null }),

  selectGroup: (group) =>
    set((s) => {
      const toAdd = [...group.items];
      if (group.totalCol) toAdd.push(group.totalCol);
      const unique = toAdd.filter((v) => !s.selectedVariables.includes(v));
      return { selectedVariables: [...s.selectedVariables, ...unique], dimResults: [], analysisRun: null };
    }),

  setFilter: (col, filter) =>
    set((s) => {
      const f = { ...s.activeFilters };
      if (filter === null) delete f[col];
      else f[col] = filter;
      return { activeFilters: f };
    }),

  clearFilters: () =>
    set((s) => {
      return {
        activeFilters: {},
        dimResults: [],
        analysisRun: null,
        filteredRows: filterRows(s.rows, {}, s.selectedRecordIds),
      };
    }),

  applyFilters: () =>
    set((s) => {
      return { filteredRows: filterRows(s.rows, s.activeFilters, s.selectedRecordIds), dimResults: [], analysisRun: null };
    }),

  setSelectedRecordIds: (ids) =>
    set((s) => {
      const selectedRecordIds = Array.from(new Set(ids.map(String)));
      const filteredRows = filterRows(s.rows, s.activeFilters, selectedRecordIds);
      return { selectedRecordIds, filteredRows, dimResults: [], analysisRun: null };
    }),

  clearSelectedRecordIds: () =>
    set((s) => {
      const filteredRows = filterRows(s.rows, s.activeFilters);
      return { selectedRecordIds: [], filteredRows, dimResults: [], analysisRun: null };
    }),

  addDimResult: (result) =>
    set((s) => ({
      dimResults: [
        ...s.dimResults.filter((r) => r.method !== result.method),
        result,
      ],
    })),

  setAnalysisRun: (analysisRun) => set({ analysisRun }),

  setActiveTab: (activeTab) => set({ activeTab }),

  openProfiling: (profilingVariable) => set({ activeTab: "profiling", profilingVariable }),

  openBivariate: (x, y, color = "official_cluster") => set({
    activeTab: "bivariado",
    bivariatePreset: { x, y, color },
  }),

  setSelectedParticipant: (row) => set({ selectedParticipant: row }),

  setLoading: (loading, message = "") =>
    set({ isLoading: loading, loadingMessage: message }),

  reset: () => set(initialState),
}));
