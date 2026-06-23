import Papa from "papaparse";
import type { DataRow } from "./store";
import type { ExtractedFile } from "./zip-utils";

// ─── Tipos internos ──────────────────────────────────────────────────────────
interface SourceInfo {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

export interface ConsolidationResult {
  rows: DataRow[];
  columns: string[];
  dataDictionary: DictRow[];
  report: IntegrationReport;
}

interface DictRow {
  variable: string;
  source_file: string;
  original_column: string;
  generated_column: string;
  aggregation: string;
  description: string;
  data_type: string;
  missing_values: number;
}

export interface IntegrationReport {
  zipFile: string;
  filesDetected: string[];
  filesUsed: string[];
  filesNotUsed: string[];
  joinKeys: Record<string, string>;
  aggregations: Record<string, string>;
  rowsPerSource: Record<string, number>;
  participantsDetected: number;
  finalRows: number;
  finalColumns: number;
  warnings: string[];
}

// ─── Parse CSV text ──────────────────────────────────────────────────────────
function parseSource(name: string, content: string): SourceInfo {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: true,
  });
  return {
    name,
    headers: result.meta.fields ?? [],
    rows: result.data,
    rowCount: result.data.length,
  };
}

function numOrNull(v: string | undefined): number | null {
  if (!v || ["", "NA", "na", "NaN", "null", "NULL"].includes(v)) return null;
  const normalized = v.trim().toLowerCase();
  const ordinalMap: Record<string, number> = {
    "never": 0,
    "rarely": 1,
    "sometimes": 2,
    "often": 3,
    "very often": 4,
    "always": 4,
  };
  if (normalized in ordinalMap) return ordinalMap[normalized];
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function avg(vals: number[]): number | null {
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ─── Consolidar fuentes OpenPlay ─────────────────────────────────────────────
export async function consolidateOpenPlayData(
  files: ExtractedFile[],
  onProgress?: (msg: string) => void
): Promise<ConsolidationResult> {
  const report: IntegrationReport = {
    zipFile: "OpenPlay ZIP",
    filesDetected: files.map((f) => f.name),
    filesUsed: [],
    filesNotUsed: [],
    joinKeys: { primary: "pid", criteria: "qualified==TRUE" },
    aggregations: {},
    rowsPerSource: {},
    participantsDetected: 0,
    finalRows: 0,
    finalColumns: 0,
    warnings: [],
  };

  const byName = new Map<string, SourceInfo>();
  for (const f of files) {
    onProgress?.(`Leyendo ${f.name}…`);
    const src = parseSource(f.name, f.content);
    byName.set(f.name, src);
    report.rowsPerSource[f.name] = src.rowCount;
  }

  // ── Intake (base) ──────────────────────────────────────────────────────────
  const intake = byName.get("survey_intake_raw.csv.gz");
  if (!intake) throw new Error("No se encontró survey_intake_raw.csv.gz");
  report.filesUsed.push("survey_intake_raw.csv.gz");

  onProgress?.("Procesando participantes calificados…");
  const participantMap = new Map<string, DataRow>();
  let recIdx = 1;

  for (const row of intake.rows) {
    if (row["qualified"] !== "TRUE" && row["qualified"] !== "1") continue;
    const pid = row["pid"];
    if (!pid) continue;

    const r: DataRow = {
      record_id: recIdx++,
      pid,
      age: numOrNull(row["age"]),
      gender: row["gender"] || null,
      country: row["country"] || null,
      cohort: row["cohort"] || null,
      edu_level: row["edu_level"] || null,
      employment: row["employment"] || null,
      marital_status: row["marital_status"] || null,
      ethnicity: row["ethnicity"] || null,
      height: numOrNull(row["height"]),
      weight: numOrNull(row["weight"]),
      self_reported_weekly_play: numOrNull(row["self_reported_weekly_play"]),
      plays_xbox: numOrNull(row["plays_xbox"]),
      plays_steam: numOrNull(row["plays_steam"]),
      plays_nintendo: numOrNull(row["plays_nintendo"]),
      plays_ios: numOrNull(row["plays_ios"]),
      plays_android: numOrNull(row["plays_android"]),
      plays_playstation: numOrNull(row["plays_playstation"]),
      neuro_identify: numOrNull(row["neuro_identify"]),
      neuro_diagnosed: numOrNull(row["neuro_diagnosed"]),
      neuro_diag_asd: numOrNull(row["neuro_diag_asd"]),
      neuro_diag_adhd: numOrNull(row["neuro_diag_adhd"]),
      neuro_diag_dyslexia: numOrNull(row["neuro_diag_dyslexia"]),
      dependents: numOrNull(row["dependents"]),
      intake_life_sat: numOrNull(row["life_sat"]),
      intake_affective_valence: numOrNull(row["affective_valence"]),
      intake_wemwbs_1: numOrNull(row["wemwbs_1"]),
      intake_wemwbs_2: numOrNull(row["wemwbs_2"]),
      intake_wemwbs_3: numOrNull(row["wemwbs_3"]),
      intake_wemwbs_4: numOrNull(row["wemwbs_4"]),
      intake_wemwbs_5: numOrNull(row["wemwbs_5"]),
      intake_wemwbs_6: numOrNull(row["wemwbs_6"]),
      intake_wemwbs_7: numOrNull(row["wemwbs_7"]),
    };

    const plats = ["plays_xbox","plays_steam","plays_nintendo","plays_ios","plays_android","plays_playstation"];
    r["num_platforms"] = plats.filter(
      (p) => row[p] === "1" || row[p] === "TRUE"
    ).length;

    participantMap.set(pid, r);
  }

  report.participantsDetected = participantMap.size;

  // ── Biweekly ──────────────────────────────────────────────────────────────
  const bw = byName.get("survey_biweekly_raw.csv.gz");
  if (bw) {
    report.filesUsed.push("survey_biweekly_raw.csv.gz");
    report.aggregations["survey_biweekly"] = "Primera ola por participante";
    onProgress?.("Procesando encuesta biweekly…");

    const pidWave1 = new Map<string, Record<string, string>>();
    const pidCount = new Map<string, number>();
    for (const row of bw.rows) {
      const pid = row["pid"];
      if (!pid) continue;
      pidCount.set(pid, (pidCount.get(pid) ?? 0) + 1);
      const w = parseInt(row["wave"]) || 999;
      const ex = pidWave1.get(pid);
      if (!ex || (parseInt(ex["wave"]) || 999) > w) pidWave1.set(pid, row);
    }

    const bwCols = [
      "gdt_1","gdt_2","gdt_3","gdt_4",
      "promis_1","promis_2","promis_3","promis_4","promis_5","promis_6","promis_7","promis_8",
      "wemwbs_1","wemwbs_2","wemwbs_3","wemwbs_4","wemwbs_5","wemwbs_6","wemwbs_7",
      "bangs_1","bangs_2","bangs_3","bangs_4","bangs_5","bangs_6","bangs_7","bangs_8","bangs_9",
      "bangs_10","bangs_11","bangs_12","bangs_13","bangs_14","bangs_15","bangs_16","bangs_17","bangs_18",
      "bfi_2_xs_1","bfi_2_xs_2","bfi_2_xs_3","bfi_2_xs_4","bfi_2_xs_5",
      "bfi_2_xs_6","bfi_2_xs_7","bfi_2_xs_8","bfi_2_xs_9","bfi_2_xs_10",
      "bfi_2_xs_11","bfi_2_xs_12","bfi_2_xs_13","bfi_2_xs_14","bfi_2_xs_15",
      "affective_valence","life_sat","self_reported_daily_play","self_reported_weekly_play",
      "gaming_value_work","gaming_value_social","gaming_value_cognitive","gaming_value_emotion","gaming_value_routines",
      "positives","problematic_play",
      "mctq_wd_sleep_latency_minutes","mctq_fd_sleep_latency_minutes","mctq_workdays_per_week",
      "eps_reading","eps_tv","eps_public","eps_passenger","eps_afternoon","eps_talking","eps_lunch","eps_car",
      "psqi_overall_quality","psqi_sleep_latency_min","psqi_sleepdur_hours",
      "trojan_1","trojan_2","trojan_3","trojan_4","trojan_5","trojan_6","trojan_7",
      "trojan_8","trojan_9","trojan_10","trojan_11","trojan_12","trojan_13","trojan_14","trojan_15",
      "played_any_games","survey_duration",
    ];

    for (const [pid, row] of pidWave1) {
      if (!participantMap.has(pid)) continue;
      const p = participantMap.get(pid)!;
      for (const col of bwCols) p[`bw_${col}`] = numOrNull(row[col]);
      p["bw_num_waves"] = pidCount.get(pid) ?? 1;

      const gdt = [1,2,3,4].map((i) => numOrNull(row[`gdt_${i}`]));
      if (gdt.every((v) => v !== null)) p["gdt_total"] = gdt.reduce((a:number, b) => a + b!, 0);
      const promis = [1,2,3,4,5,6,7,8].map((i) => numOrNull(row[`promis_${i}`]));
      if (promis.every((v) => v !== null)) p["promis_total"] = promis.reduce((a:number, b) => a + b!, 0);
      const wemwbs = [1,2,3,4,5,6,7].map((i) => numOrNull(row[`wemwbs_${i}`]));
      if (wemwbs.every((v) => v !== null)) p["wemwbs_total"] = wemwbs.reduce((a:number, b) => a + b!, 0);
      const bangs = Array.from({ length: 18 }, (_, i) => numOrNull(row[`bangs_${i + 1}`])).filter((v): v is number => v !== null);
      if (bangs.length >= 15) p["bangs_total"] = bangs.reduce((a, b) => a + b, 0);
    }
  }

  // ── Daily ─────────────────────────────────────────────────────────────────
  const daily = byName.get("survey_daily_raw.csv.gz");
  if (daily) {
    report.filesUsed.push("survey_daily_raw.csv.gz");
    report.aggregations["survey_daily"] = "Conteos y promedios por participante";
    onProgress?.("Procesando encuesta diaria…");
    const byPid = new Map<string, Record<string, string>[]>();
    for (const row of daily.rows) {
      const pid = row["pid"];
      if (!pid || !participantMap.has(pid)) continue;
      if (!byPid.has(pid)) byPid.set(pid, []);
      byPid.get(pid)!.push(row);
    }
    for (const [pid, rows] of byPid) {
      const p = participantMap.get(pid)!;
      p["daily_num_responses"] = rows.length;
      p["daily_played_days"] = rows.filter((r) => r["played24hr"] === "1" || r["played24hr"] === "TRUE").length;
      p["daily_stress_days"] = rows.filter((r) => r["had_stress"] === "1" || r["had_stress"] === "TRUE").length;
    }
  }

  // ── Android ───────────────────────────────────────────────────────────────
  const android = byName.get("telemetry_android_raw.csv.gz");
  if (android) {
    report.filesUsed.push("telemetry_android_raw.csv.gz");
    report.aggregations["telemetry_android"] = "Suma y media de minutos diarios";
    onProgress?.("Procesando telemetría Android…");
    const byPid = new Map<string, number[]>();
    for (const row of android.rows) {
      const pid = row["pid"];
      if (!pid || !participantMap.has(pid)) continue;
      const m = numOrNull(row["total_gaming_minutes"]);
      if (!byPid.has(pid)) byPid.set(pid, []);
      if (m !== null) byPid.get(pid)!.push(m);
    }
    for (const [pid, mins] of byPid) {
      const p = participantMap.get(pid)!;
      p["android_total_minutes"] = mins.reduce((a, b) => a + b, 0);
      p["android_mean_daily_minutes"] = avg(mins);
      p["android_days_with_data"] = mins.length;
    }
  }

  // ── iOS ───────────────────────────────────────────────────────────────────
  const ios = byName.get("telemetry_ios_raw.csv.gz");
  if (ios) {
    report.filesUsed.push("telemetry_ios_raw.csv.gz");
    report.aggregations["telemetry_ios"] = "Suma y media de minutos diarios";
    onProgress?.("Procesando telemetría iOS…");
    const byPid = new Map<string, number[]>();
    for (const row of ios.rows) {
      const pid = row["pid"];
      if (!pid || !participantMap.has(pid)) continue;
      const m = numOrNull(row["total_gaming_minutes"]);
      if (!byPid.has(pid)) byPid.set(pid, []);
      if (m !== null) byPid.get(pid)!.push(m);
    }
    for (const [pid, mins] of byPid) {
      const p = participantMap.get(pid)!;
      p["ios_total_minutes"] = mins.reduce((a, b) => a + b, 0);
      p["ios_mean_daily_minutes"] = avg(mins);
      p["ios_days_with_data"] = mins.length;
    }
  }

  // ── Nintendo ──────────────────────────────────────────────────────────────
  const nintendo = byName.get("telemetry_nintendo_raw.csv.gz");
  if (nintendo) {
    report.filesUsed.push("telemetry_nintendo_raw.csv.gz");
    report.aggregations["telemetry_nintendo"] = "Sesiones, duración, nocturnas";
    onProgress?.("Procesando telemetría Nintendo…");
    const byPid = new Map<string, { durs: number[]; nocturnal: number; games: Set<string> }>();
    for (const row of nintendo.rows) {
      const pid = row["pid"];
      if (!pid || !participantMap.has(pid)) continue;
      if (!byPid.has(pid)) byPid.set(pid, { durs: [], nocturnal: 0, games: new Set() });
      const acc = byPid.get(pid)!;
      const d = numOrNull(row["duration"]);
      if (d !== null) acc.durs.push(d);
      const start = row["session_start"] ?? "";
      const hm = start.match(/T(\d{2}):/);
      if (hm) { const h = parseInt(hm[1]); if (h < 6 || h >= 22) acc.nocturnal++; }
      acc.games.add(row["title_id"] ?? "");
    }
    for (const [pid, acc] of byPid) {
      const p = participantMap.get(pid)!;
      p["nintendo_total_sessions"] = acc.durs.length;
      p["nintendo_total_duration_min"] = acc.durs.reduce((a, b) => a + b, 0);
      p["nintendo_mean_session_min"] = avg(acc.durs);
      p["nintendo_max_session_min"] = acc.durs.length ? Math.max(...acc.durs) : null;
      p["nintendo_unique_games"] = acc.games.size;
      p["nintendo_nocturnal_sessions"] = acc.nocturnal;
    }
  }

  // ── Xbox ──────────────────────────────────────────────────────────────────
  const xbox = byName.get("telemetry_xbox_raw.csv.gz");
  if (xbox) {
    report.filesUsed.push("telemetry_xbox_raw.csv.gz");
    report.aggregations["telemetry_xbox"] = "Sesiones, duración, nocturnas";
    onProgress?.("Procesando telemetría Xbox…");
    const byPid = new Map<string, { durs: number[]; nocturnal: number; games: Set<string> }>();
    for (const row of xbox.rows) {
      const pid = row["pid"];
      if (!pid || !participantMap.has(pid)) continue;
      if (!byPid.has(pid)) byPid.set(pid, { durs: [], nocturnal: 0, games: new Set() });
      const acc = byPid.get(pid)!;
      const d = numOrNull(row["duration"]);
      if (d !== null) acc.durs.push(d);
      const start = row["session_start"] ?? "";
      const hm = start.match(/T(\d{2}):/);
      if (hm) { const h = parseInt(hm[1]); if (h < 6 || h >= 22) acc.nocturnal++; }
      acc.games.add(row["title_id"] ?? "");
    }
    for (const [pid, acc] of byPid) {
      const p = participantMap.get(pid)!;
      p["xbox_total_sessions"] = acc.durs.length;
      p["xbox_total_duration_min"] = acc.durs.reduce((a, b) => a + b, 0);
      p["xbox_mean_session_min"] = avg(acc.durs);
      p["xbox_max_session_min"] = acc.durs.length ? Math.max(...acc.durs) : null;
      p["xbox_unique_games"] = acc.games.size;
      p["xbox_nocturnal_sessions"] = acc.nocturnal;
    }
    report.warnings.push("Xbox: 4.9M filas — procesado puede ser lento en navegador. Usa npm run build:data para mejor rendimiento.");
  }

  // ── Steam ─────────────────────────────────────────────────────────────────
  const steam = byName.get("telemetry_steam_raw.csv.gz");
  if (steam) {
    report.filesUsed.push("telemetry_steam_raw.csv.gz");
    report.aggregations["telemetry_steam"] = "Max playtime, juegos únicos";
    onProgress?.("Procesando telemetría Steam…");
    const byPid = new Map<string, { maxPt2w: number; maxPtF: number; games: Set<string>; count: number }>();
    for (const row of steam.rows) {
      const pid = row["pid"];
      if (!pid || !participantMap.has(pid)) continue;
      if (!byPid.has(pid)) byPid.set(pid, { maxPt2w: 0, maxPtF: 0, games: new Set(), count: 0 });
      const acc = byPid.get(pid)!;
      acc.count++;
      const pt2w = numOrNull(row["playtime_2weeks"]); if (pt2w !== null) acc.maxPt2w = Math.max(acc.maxPt2w, pt2w);
      const ptF = numOrNull(row["playtime_forever"]); if (ptF !== null) acc.maxPtF = Math.max(acc.maxPtF, ptF);
      acc.games.add(row["title_id"] ?? "");
    }
    for (const [pid, acc] of byPid) {
      const p = participantMap.get(pid)!;
      p["steam_playtime_2weeks_max"] = acc.maxPt2w;
      p["steam_playtime_forever_max"] = acc.maxPtF;
      p["steam_unique_games"] = acc.games.size;
      p["steam_total_records"] = acc.count;
    }
  }

  // ── Steam owned games ─────────────────────────────────────────────────────
  const steamOwned = byName.get("telemetry_steam_owned_games_raw.csv.gz");
  if (steamOwned) {
    report.filesUsed.push("telemetry_steam_owned_games_raw.csv.gz");
    onProgress?.("Procesando Steam owned games…");
    const byPid = new Map<string, { count: number; total: number }>();
    for (const row of steamOwned.rows) {
      const pid = row["pid"];
      if (!pid || !participantMap.has(pid)) continue;
      if (!byPid.has(pid)) byPid.set(pid, { count: 0, total: 0 });
      const acc = byPid.get(pid)!;
      acc.count++;
      const ptF = numOrNull(row["playtime_forever"]); if (ptF !== null) acc.total += ptF;
    }
    for (const [pid, acc] of byPid) {
      const p = participantMap.get(pid)!;
      p["steam_owned_games_count"] = acc.count;
      p["steam_owned_total_playtime"] = acc.total;
    }
  }

  // ── Steam account linking ─────────────────────────────────────────────────
  const steamLink = byName.get("telemetry_steam_account_linking_raw.csv.gz");
  if (steamLink) {
    report.filesUsed.push("telemetry_steam_account_linking_raw.csv.gz");
    const byPid = new Map<string, number>();
    for (const row of steamLink.rows) {
      const pid = row["pid"];
      if (!pid || !participantMap.has(pid)) continue;
      byPid.set(pid, (byPid.get(pid) ?? 0) + 1);
    }
    for (const [pid, count] of byPid) {
      const p = participantMap.get(pid)!;
      p["steam_linked"] = 1;
      p["steam_link_events"] = count;
    }
  }

  // ── Cognitive tasks ───────────────────────────────────────────────────────
  const cog = byName.get("cognitive_tasks_raw.csv.gz");
  if (cog) {
    report.filesUsed.push("cognitive_tasks_raw.csv.gz");
    report.aggregations["cognitive_tasks"] = "Media RT, precisión, conteo tareas";
    onProgress?.("Procesando tareas cognitivas…");
    const byPid = new Map<string, { rts: number[]; accs: number[]; tasks: Set<string> }>();
    for (const row of cog.rows) {
      const pid = row["pid"];
      if (!pid || !participantMap.has(pid)) continue;
      if (!byPid.has(pid)) byPid.set(pid, { rts: [], accs: [], tasks: new Set() });
      const acc = byPid.get(pid)!;
      const rt = numOrNull(row["rt"]); if (rt !== null) acc.rts.push(rt);
      const a = numOrNull(row["accuracy"]); if (a !== null) acc.accs.push(a);
      acc.tasks.add(row["task"] ?? "");
    }
    for (const [pid, acc] of byPid) {
      const p = participantMap.get(pid)!;
      p["cog_mean_rt"] = avg(acc.rts);
      p["cog_mean_accuracy"] = avg(acc.accs);
      p["cog_num_tasks"] = acc.tasks.size;
      p["cog_num_trials"] = acc.rts.length;
    }
  }

  // ── Time use ──────────────────────────────────────────────────────────────
  const timeuse = byName.get("timeuse_raw.csv.gz");
  if (timeuse) {
    report.filesUsed.push("timeuse_raw.csv.gz");
    report.aggregations["timeuse"] = "Entradas, días, entradas de gaming";
    onProgress?.("Procesando uso del tiempo…");
    const byPid = new Map<string, { days: Set<string>; total: number; gaming: number }>();
    for (const row of timeuse.rows) {
      const pid = row["pid"];
      if (!pid || !participantMap.has(pid)) continue;
      if (!byPid.has(pid)) byPid.set(pid, { days: new Set(), total: 0, gaming: 0 });
      const acc = byPid.get(pid)!;
      acc.days.add(row["date"] ?? ""); acc.total++;
      if ((row["activity"] ?? "").toLowerCase().includes("gam")) acc.gaming++;
    }
    for (const [pid, acc] of byPid) {
      const p = participantMap.get(pid)!;
      p["timeuse_num_entries"] = acc.total;
      p["timeuse_num_days"] = acc.days.size;
      p["timeuse_gaming_entries"] = acc.gaming;
    }
  }

  // ── No usados ─────────────────────────────────────────────────────────────
  for (const f of files) {
    if (!report.filesUsed.includes(f.name)) {
      report.filesNotUsed.push(f.name);
    }
  }
  report.warnings.push("master_table_openplay_core_v3.csv: Sin columna pid — no se puede unir a participantes.");
  report.warnings.push("biweekly.csv: Diccionario de datos, no es tabla de participantes.");
  report.warnings.push("games.csv.gz: Tabla de referencia sin pid.");

  // ── Indicadores de disponibilidad ────────────────────────────────────────
  onProgress?.("Calculando indicadores de disponibilidad…");
  for (const [, p] of participantMap) {
    p["has_biweekly"] = p["bw_gdt_1"] !== null && p["bw_gdt_1"] !== undefined ? 1 : 0;
    p["has_daily"] = p["daily_num_responses"] !== undefined ? 1 : 0;
    p["has_android"] = p["android_total_minutes"] !== undefined ? 1 : 0;
    p["has_ios"] = p["ios_total_minutes"] !== undefined ? 1 : 0;
    p["has_nintendo"] = p["nintendo_total_sessions"] !== undefined ? 1 : 0;
    p["has_xbox"] = p["xbox_total_sessions"] !== undefined ? 1 : 0;
    p["has_steam"] = p["steam_total_records"] !== undefined ? 1 : 0;
    p["has_cognitive"] = p["cog_num_trials"] !== undefined ? 1 : 0;
    p["has_timeuse"] = p["timeuse_num_entries"] !== undefined ? 1 : 0;
    const tp = [p["has_android"], p["has_ios"], p["has_nintendo"], p["has_xbox"], p["has_steam"]];
    p["num_telemetry_platforms"] = tp.filter((v) => v === 1).length;
    p["has_any_telemetry"] = p["num_telemetry_platforms"] > 0 ? 1 : 0;

    const nintendoNocturnal = Number(p["nintendo_nocturnal_sessions"] ?? 0) || 0;
    const xboxNocturnal = Number(p["xbox_nocturnal_sessions"] ?? 0) || 0;
    p["telem_nocturnal_sessions"] = nintendoNocturnal + xboxNocturnal;

    const androidDays = Number(p["android_days_with_data"] ?? 0) || 0;
    const iosDays = Number(p["ios_days_with_data"] ?? 0) || 0;
    const nintendoSessions = Number(p["nintendo_total_sessions"] ?? 0) || 0;
    const xboxSessions = Number(p["xbox_total_sessions"] ?? 0) || 0;
    const steamRecords = Number(p["steam_total_records"] ?? 0) || 0;
    p["telem_total_sessions"] = androidDays + iosDays + nintendoSessions + xboxSessions + steamRecords;

    if (p["steam_playtime_2weeks_max"] !== null && p["steam_playtime_2weeks_max"] !== undefined) {
      p["steam_playtime_2weeks_min"] = p["steam_playtime_2weeks_max"];
    }
  }

  // ── Armar resultado final ─────────────────────────────────────────────────
  onProgress?.("Generando dataset consolidado…");
  const allRows = Array.from(participantMap.values());
  const colSet = new Set<string>();
  for (const row of allRows) Object.keys(row).forEach((k) => colSet.add(k));

  const priorityCols = [
    "record_id","pid","age","gender","country","cohort","edu_level","employment",
    "marital_status","ethnicity","height","weight","num_platforms","self_reported_weekly_play",
    "plays_xbox","plays_steam","plays_nintendo","plays_ios","plays_android","plays_playstation",
    "neuro_identify","neuro_diagnosed","neuro_diag_asd","neuro_diag_adhd","neuro_diag_dyslexia","dependents",
    "intake_life_sat","intake_affective_valence",
    "intake_wemwbs_1","intake_wemwbs_2","intake_wemwbs_3","intake_wemwbs_4","intake_wemwbs_5","intake_wemwbs_6","intake_wemwbs_7",
    "gdt_total","promis_total","wemwbs_total","bangs_total",
    "telem_nocturnal_sessions","telem_total_sessions","steam_playtime_2weeks_min",
    "bw_gdt_1","bw_gdt_2","bw_gdt_3","bw_gdt_4",
    "bw_promis_1","bw_promis_2","bw_promis_3","bw_promis_4","bw_promis_5","bw_promis_6","bw_promis_7","bw_promis_8",
    "bw_wemwbs_1","bw_wemwbs_2","bw_wemwbs_3","bw_wemwbs_4","bw_wemwbs_5","bw_wemwbs_6","bw_wemwbs_7",
  ];
  const restCols = Array.from(colSet).filter((c) => !priorityCols.includes(c)).sort();
  const columns = [...priorityCols.filter((c) => colSet.has(c)), ...restCols];

  // ── Diccionario ───────────────────────────────────────────────────────────
  const dataDictionary: DictRow[] = columns.map((col) => {
    const missing = allRows.filter(
      (r) => r[col] === null || r[col] === undefined || r[col] === ""
    ).length;
    const src = col.startsWith("bw_") || ["gdt_total","promis_total","wemwbs_total","bangs_total"].includes(col)
      ? "survey_biweekly_raw.csv.gz"
      : col.startsWith("daily_") ? "survey_daily_raw.csv.gz"
      : col.startsWith("android_") ? "telemetry_android_raw.csv.gz"
      : col.startsWith("ios_") ? "telemetry_ios_raw.csv.gz"
      : col.startsWith("nintendo_") ? "telemetry_nintendo_raw.csv.gz"
      : col.startsWith("xbox_") ? "telemetry_xbox_raw.csv.gz"
      : col.startsWith("steam_") ? "telemetry_steam_raw.csv.gz"
      : col.startsWith("telem_") ? "derived_telemetry"
      : col.startsWith("cog_") ? "cognitive_tasks_raw.csv.gz"
      : col.startsWith("timeuse_") ? "timeuse_raw.csv.gz"
      : "survey_intake_raw.csv.gz";
    const agg = col.startsWith("bw_") ? "first_wave"
      : col.endsWith("_total") ? "sum"
      : col.startsWith("daily_") || col.startsWith("android_") || col.startsWith("ios_") ||
        col.startsWith("nintendo_") || col.startsWith("xbox_") || col.startsWith("steam_") ||
        col.startsWith("telem_") || col.startsWith("cog_") || col.startsWith("timeuse_") ? "aggregated"
      : "direct";
    return {
      variable: col, source_file: src,
      original_column: col.startsWith("bw_") ? col.replace("bw_","") : col,
      generated_column: col, aggregation: agg,
      description: `Variable: ${col}`, data_type: "mixed", missing_values: missing,
    };
  });

  report.finalRows = allRows.length;
  report.finalColumns = columns.length;

  return { rows: allRows, columns, dataDictionary, report };
}
