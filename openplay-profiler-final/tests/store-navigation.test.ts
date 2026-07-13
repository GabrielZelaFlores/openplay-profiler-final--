import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "../lib/store";

afterEach(() => useStore.getState().reset());

describe("navegacion coordinada entre vistas", () => {
  it("abre Bivariado con las variables del caso y el cluster oficial", () => {
    useStore.getState().openBivariate("telem_total_sessions", "telem_nocturnal_sessions");
    const state = useStore.getState();
    expect(state.activeTab).toBe("bivariado");
    expect(state.bivariatePreset).toEqual({
      x: "telem_total_sessions",
      y: "telem_nocturnal_sessions",
      color: "official_cluster",
    });
  });

  it("abre Profiling directamente en la variable solicitada", () => {
    useStore.getState().openProfiling("promis_total");
    const state = useStore.getState();
    expect(state.activeTab).toBe("profiling");
    expect(state.profilingVariable).toBe("promis_total");
  });
});

