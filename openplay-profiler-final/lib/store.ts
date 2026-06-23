import { create } from "zustand";

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
  isLoading: false,
  loadingMessage: "",
};

export const useStore = create<StoreState>((set, get) => ({
  ...initialState,

  setDataset: (data) => set((s) => ({
    ...s,
    ...data,
    selectedRecordIds: [],
    selectedParticipant: null,
  })),

  toggleVariable: (col) =>
    set((s) => ({
      selectedVariables: s.selectedVariables.includes(col)
        ? s.selectedVariables.filter((v) => v !== col)
        : [...s.selectedVariables, col],
    })),

  clearVariables: () => set({ selectedVariables: [] }),

  selectGroup: (group) =>
    set((s) => {
      const toAdd = [...group.items];
      if (group.totalCol) toAdd.push(group.totalCol);
      const unique = toAdd.filter((v) => !s.selectedVariables.includes(v));
      return { selectedVariables: [...s.selectedVariables, ...unique] };
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
      const selected = new Set(s.selectedRecordIds);
      return {
        activeFilters: {},
        filteredRows: selected.size
          ? s.rows.filter((row) => selected.has(String(row["record_id"])))
          : s.rows,
      };
    }),

  applyFilters: () =>
    set((s) => {
      const filters = s.activeFilters;
      const selected = new Set(s.selectedRecordIds);
      const filtered = s.rows.filter((row) => {
        if (selected.size && !selected.has(String(row["record_id"]))) return false;
        for (const [col, f] of Object.entries(filters)) {
          const v = row[col];
          const isNull = v === null || v === undefined || v === "";
          if (f.min !== undefined || f.max !== undefined) {
            if (isNull) {
              if (f.includeMissing === false) return false;
              continue;
            }
            const n = typeof v === "number" ? v : parseFloat(String(v));
            if (isNaN(n)) { if (!f.includeMissing) return false; continue; }
            if (f.min !== undefined && n < f.min) return false;
            if (f.max !== undefined && n > f.max) return false;
          }
          if (f.values && f.values.length > 0) {
            if (!f.values.includes(String(v ?? ""))) return false;
          }
        }
        return true;
      });
      return { filteredRows: filtered };
    }),

  setSelectedRecordIds: (ids) =>
    set((s) => {
      const selectedRecordIds = Array.from(new Set(ids.map(String)));
      const selected = new Set(selectedRecordIds);
      const filters = s.activeFilters;
      const filteredRows = s.rows.filter((row) => {
        if (selected.size && !selected.has(String(row["record_id"]))) return false;
        for (const [col, f] of Object.entries(filters)) {
          const v = row[col];
          const isNull = v === null || v === undefined || v === "";
          if (f.min !== undefined || f.max !== undefined) {
            if (isNull) {
              if (f.includeMissing === false) return false;
              continue;
            }
            const n = typeof v === "number" ? v : parseFloat(String(v));
            if (isNaN(n)) { if (!f.includeMissing) return false; continue; }
            if (f.min !== undefined && n < f.min) return false;
            if (f.max !== undefined && n > f.max) return false;
          }
          if (f.values && f.values.length > 0) {
            if (!f.values.includes(String(v ?? ""))) return false;
          }
        }
        return true;
      });
      return { selectedRecordIds, filteredRows };
    }),

  clearSelectedRecordIds: () =>
    set((s) => {
      const filters = s.activeFilters;
      if (Object.keys(filters).length === 0) return { selectedRecordIds: [], filteredRows: s.rows };
      const filteredRows = s.rows.filter((row) => {
        for (const [col, f] of Object.entries(filters)) {
          const v = row[col];
          const isNull = v === null || v === undefined || v === "";
          if (f.min !== undefined || f.max !== undefined) {
            if (isNull) {
              if (f.includeMissing === false) return false;
              continue;
            }
            const n = typeof v === "number" ? v : parseFloat(String(v));
            if (isNaN(n)) { if (!f.includeMissing) return false; continue; }
            if (f.min !== undefined && n < f.min) return false;
            if (f.max !== undefined && n > f.max) return false;
          }
          if (f.values && f.values.length > 0) {
            if (!f.values.includes(String(v ?? ""))) return false;
          }
        }
        return true;
      });
      return { selectedRecordIds: [], filteredRows };
    }),

  addDimResult: (result) =>
    set((s) => ({
      dimResults: [
        ...s.dimResults.filter((r) => r.method !== result.method),
        result,
      ],
    })),

  setSelectedParticipant: (row) => set({ selectedParticipant: row }),

  setLoading: (loading, message = "") =>
    set({ isLoading: loading, loadingMessage: message }),

  reset: () => set(initialState),
}));
