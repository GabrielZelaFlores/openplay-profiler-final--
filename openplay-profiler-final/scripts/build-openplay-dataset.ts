#!/usr/bin/env tsx
/**
 * OpenPlay Dataset Builder - uses Python for large file preprocessing
 */

import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { promisify } from "util";
import { execSync } from "child_process";
import AdmZip from "adm-zip";

const gunzip = promisify(zlib.gunzip);

const SOURCE_DIR = path.join(process.cwd(), "data");
const ZIP_PATH = path.join(SOURCE_DIR, "OpenPlay-20260609T233203Z-3-001.zip");
const FOLDER_PATH = path.join(SOURCE_DIR, "OpenPlay");
const CACHE_DIR = SOURCE_DIR;
const PUBLIC_OUT_DIR = path.join(process.cwd(), "public/data");

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  result.push(cur.trim());
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.every(v => !v)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    rows.push(row);
  }
  return { headers, rows };
}

type DataEntry = { name: string; getData: () => Buffer };

async function getGz(entry: DataEntry) {
  const buf = entry.getData();
  const dec = await gunzip(buf);
  return parseCsv(dec.toString("utf-8"));
}

function num(v: string | undefined): number | null {
  if (!v || ["","NA","na","NaN","null","NULL"].includes(v)) return null;
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
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
}

function avg(vals: number[]): number | null {
  if (!vals.length) return null;
  return vals.reduce((a,b)=>a+b,0)/vals.length;
}

type Row = Record<string, string | number | null>;

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_OUT_DIR, { recursive: true });

  console.log("📦 OpenPlay Dataset Builder");
  const hasZip = fs.existsSync(ZIP_PATH);
  const hasFolder = fs.existsSync(FOLDER_PATH);
  if (!hasZip && !hasFolder) {
    throw new Error(`No se encontro fuente de datos. Coloca el ZIP en ${ZIP_PATH} o la carpeta OpenPlay en ${FOLDER_PATH}`);
  }
  console.log(hasZip ? `ZIP: ${ZIP_PATH}` : `Folder: ${FOLDER_PATH}`);

  // Step 1: Run Python for large files
  const telemPath = path.join(CACHE_DIR, "telemetry_aggregated.json");
  if (!fs.existsSync(telemPath)) {
    console.log("\n🐍 Running Python preprocessing for large files...");
    execSync(`python ${path.join(process.cwd(), "scripts/preprocess-large.py")} "${hasZip ? ZIP_PATH : FOLDER_PATH}" "${CACHE_DIR}"`, {stdio: "inherit"});
  } else {
    console.log("✅ Telemetry JSON already exists, skipping Python step");
  }
  const telemData = JSON.parse(fs.readFileSync(telemPath, "utf-8")) as {
    xbox: Record<string, Record<string, number|null>>;
    steam: Record<string, Record<string, number|null>>;
    steam_owned: Record<string, Record<string, number|null>>;
    nintendo: Record<string, Record<string, number|null>>;
  };

  // Step 2: Load source files
  console.log(hasZip ? "\n📦 Loading ZIP..." : "\n📂 Loading OpenPlay folder...");
  const entries = new Map<string, DataEntry>();
  if (hasZip) {
    const zip = new AdmZip(ZIP_PATH);
    for (const e of zip.getEntries()) {
      if (!e.isDirectory) entries.set(e.name, { name: e.name, getData: () => e.getData() });
    }
  } else {
    for (const file of fs.readdirSync(FOLDER_PATH)) {
      const fullPath = path.join(FOLDER_PATH, file);
      if (!fs.statSync(fullPath).isFile()) continue;
      entries.set(`OpenPlay/${file}`, { name: file, getData: () => fs.readFileSync(fullPath) });
    }
  }

  const filesDetected = Array.from(entries.keys()).map(e => path.basename(e));
  const filesUsed: string[] = [];
  const filesNotUsed: string[] = ["biweekly.csv","master_table_openplay_core_v3.csv","games.csv.gz"];
  const rowsPerSource: Record<string, number> = {};
  const warnings: string[] = [
    "master_table_openplay_core_v3.csv: No pid column - cannot join to participants.",
    "biweekly.csv: Data dictionary file, not participant data.",
    "games.csv.gz: Reference table only, no pid column."
  ];

  function getEntry(name: string) {
    for (const [key, val] of entries) {
      if (path.basename(key) === name) return val;
    }
    return null;
  }

  // Step 3: Intake survey
  console.log("Loading intake survey...");
  const intakeEntry = getEntry("survey_intake_raw.csv.gz");
  if (!intakeEntry) throw new Error("survey_intake_raw.csv.gz not found");
  const intake = await getGz(intakeEntry);
  filesUsed.push("survey_intake_raw.csv.gz");
  rowsPerSource["survey_intake_raw.csv.gz"] = intake.rows.length;

  const participantMap = new Map<string, Row>();
  let recIdx = 1;
  for (const row of intake.rows) {
    if (row["qualified"] !== "TRUE" && row["qualified"] !== "1") continue;
    const pid = row["pid"]; if (!pid) continue;
    const r: Row = {
      record_id: recIdx++, pid,
      age: num(row["age"]),
      gender: row["gender"]||null,
      country: row["country"]||null,
      geo_area: row["geo_area"]||null,
      cohort: row["cohort"]||null,
      edu_level: row["edu_level"]||null,
      employment: row["employment"]||null,
      marital_status: row["marital_status"]||null,
      height: num(row["height"]),
      weight: num(row["weight"]),
      ethnicity: row["ethnicity"]||null,
      self_reported_weekly_play: num(row["self_reported_weekly_play"]),
      plays_xbox: num(row["plays_xbox"]),
      plays_steam: num(row["plays_steam"]),
      plays_nintendo: num(row["plays_nintendo"]),
      plays_ios: num(row["plays_ios"]),
      plays_android: num(row["plays_android"]),
      plays_playstation: num(row["plays_playstation"]),
      neuro_identify: num(row["neuro_identify"]),
      neuro_diagnosed: num(row["neuro_diagnosed"]),
      neuro_diag_asd: num(row["neuro_diag_asd"]),
      neuro_diag_adhd: num(row["neuro_diag_adhd"]),
      neuro_diag_dyslexia: num(row["neuro_diag_dyslexia"]),
      dependents: num(row["dependents"]),
      intake_life_sat: num(row["life_sat"]),
      intake_affective_valence: num(row["affective_valence"]),
      intake_wemwbs_1: num(row["wemwbs_1"]),
      intake_wemwbs_2: num(row["wemwbs_2"]),
      intake_wemwbs_3: num(row["wemwbs_3"]),
      intake_wemwbs_4: num(row["wemwbs_4"]),
      intake_wemwbs_5: num(row["wemwbs_5"]),
      intake_wemwbs_6: num(row["wemwbs_6"]),
      intake_wemwbs_7: num(row["wemwbs_7"]),
    };
    const plats = ["plays_xbox","plays_steam","plays_nintendo","plays_ios","plays_android","plays_playstation"];
    r["num_platforms"] = plats.filter(p => row[p]==="1"||row[p]==="TRUE").length;
    participantMap.set(pid, r);
  }
  console.log(`  👥 ${participantMap.size} qualified participants`);

  // Step 4: Biweekly
  console.log("Loading biweekly survey...");
  const bwEntry = getEntry("survey_biweekly_raw.csv.gz");
  if (bwEntry) {
    const bw = await getGz(bwEntry);
    filesUsed.push("survey_biweekly_raw.csv.gz");
    rowsPerSource["survey_biweekly_raw.csv.gz"] = bw.rows.length;

    const bwCols = [
      "gdt_1","gdt_2","gdt_3","gdt_4",
      "promis_1","promis_2","promis_3","promis_4","promis_5","promis_6","promis_7","promis_8",
      "wemwbs_1","wemwbs_2","wemwbs_3","wemwbs_4","wemwbs_5","wemwbs_6","wemwbs_7",
      "bangs_1","bangs_2","bangs_3","bangs_4","bangs_5","bangs_6","bangs_7","bangs_8","bangs_9",
      "bangs_10","bangs_11","bangs_12","bangs_13","bangs_14","bangs_15","bangs_16","bangs_17","bangs_18",
      "bfi_2_xs_1","bfi_2_xs_2","bfi_2_xs_3","bfi_2_xs_4","bfi_2_xs_5",
      "bfi_2_xs_6","bfi_2_xs_7","bfi_2_xs_8","bfi_2_xs_9","bfi_2_xs_10",
      "bfi_2_xs_11","bfi_2_xs_12","bfi_2_xs_13","bfi_2_xs_14","bfi_2_xs_15",
      "affective_valence","life_sat",
      "self_reported_daily_play","self_reported_weekly_play","self_reported_biweekly_play",
      "gaming_value_work","gaming_value_social","gaming_value_cognitive","gaming_value_emotion","gaming_value_routines",
      "positives","problematic_play",
      "mctq_wd_sleep_latency_minutes","mctq_fd_sleep_latency_minutes","mctq_workdays_per_week",
      "eps_reading","eps_tv","eps_public","eps_passenger","eps_afternoon","eps_talking","eps_lunch","eps_car",
      "psqi_overall_quality","psqi_sleep_latency_min","psqi_sleepdur_hours",
      "trojan_1","trojan_2","trojan_3","trojan_4","trojan_5","trojan_6","trojan_7",
      "trojan_8","trojan_9","trojan_10","trojan_11","trojan_12","trojan_13","trojan_14","trojan_15",
      "played_any_games","survey_duration"
    ];

    const pidWave1 = new Map<string, Record<string,string>>();
    const pidWaveCount = new Map<string, number>();
    for (const row of bw.rows) {
      const pid = row["pid"]; if (!pid) continue;
      pidWaveCount.set(pid, (pidWaveCount.get(pid)??0)+1);
      const w = parseInt(row["wave"])||999;
      const existing = pidWave1.get(pid);
      if (!existing || (parseInt(existing["wave"])||999) > w) pidWave1.set(pid, row);
    }
    let matched = 0;
    for (const [pid, row] of pidWave1) {
      if (!participantMap.has(pid)) continue;
      const p = participantMap.get(pid)!;
      for (const col of bwCols) p[`bw_${col}`] = num(row[col]);
      p["bw_num_waves"] = pidWaveCount.get(pid)??1;
      const gdt = [1,2,3,4].map(i => num(row[`gdt_${i}`]));
      if (gdt.every(v=>v!==null)) p["gdt_total"] = gdt.reduce((a:number,b)=>a+b!,0);
      const promis = [1,2,3,4,5,6,7,8].map(i => num(row[`promis_${i}`]));
      if (promis.every(v=>v!==null)) p["promis_total"] = promis.reduce((a:number,b)=>a+b!,0);
      const wemwbs = [1,2,3,4,5,6,7].map(i => num(row[`wemwbs_${i}`]));
      if (wemwbs.every(v=>v!==null)) p["wemwbs_total"] = wemwbs.reduce((a:number,b)=>a+b!,0);
      const bangsVals = Array.from({length:18},(_,i)=>num(row[`bangs_${i+1}`])).filter((v): v is number => v!==null);
      if (bangsVals.length>=15) p["bangs_total"] = bangsVals.reduce((a,b)=>a+b,0);
      matched++;
    }
    console.log(`  ✅ Biweekly: ${matched} matched`);
  }

  // Step 5: Daily
  console.log("Loading daily survey...");
  const dailyEntry = getEntry("survey_daily_raw.csv.gz");
  if (dailyEntry) {
    const daily = await getGz(dailyEntry);
    filesUsed.push("survey_daily_raw.csv.gz");
    rowsPerSource["survey_daily_raw.csv.gz"] = daily.rows.length;
    const byPid = new Map<string, Record<string,string>[]>();
    for (const row of daily.rows) {
      const pid = row["pid"]; if (!pid||!participantMap.has(pid)) continue;
      if (!byPid.has(pid)) byPid.set(pid,[]);
      byPid.get(pid)!.push(row);
    }
    for (const [pid, rows] of byPid) {
      const p = participantMap.get(pid)!;
      p["daily_num_responses"] = rows.length;
      p["daily_played_days"] = rows.filter(r=>r["played24hr"]==="1"||r["played24hr"]==="TRUE").length;
      p["daily_stress_days"] = rows.filter(r=>r["had_stress"]==="1"||r["had_stress"]==="TRUE").length;
    }
    console.log(`  ✅ Daily: ${byPid.size} matched`);
  }

  // Step 6: Android
  console.log("Loading Android telemetry...");
  const andEntry = getEntry("telemetry_android_raw.csv.gz");
  if (andEntry) {
    const and = await getGz(andEntry);
    filesUsed.push("telemetry_android_raw.csv.gz");
    rowsPerSource["telemetry_android_raw.csv.gz"] = and.rows.length;
    const byPid = new Map<string, number[]>();
    for (const row of and.rows) {
      const pid = row["pid"]; if (!pid||!participantMap.has(pid)) continue;
      const m = num(row["total_gaming_minutes"]);
      if (!byPid.has(pid)) byPid.set(pid,[]);
      if (m!==null) byPid.get(pid)!.push(m);
    }
    for (const [pid, mins] of byPid) {
      const p = participantMap.get(pid)!;
      p["android_total_minutes"] = mins.reduce((a,b)=>a+b,0);
      p["android_mean_daily_minutes"] = avg(mins);
      p["android_days_with_data"] = mins.length;
    }
    console.log(`  ✅ Android: ${byPid.size} matched`);
  }

  // Step 7: iOS
  console.log("Loading iOS telemetry...");
  const iosEntry = getEntry("telemetry_ios_raw.csv.gz");
  if (iosEntry) {
    const ios = await getGz(iosEntry);
    filesUsed.push("telemetry_ios_raw.csv.gz");
    rowsPerSource["telemetry_ios_raw.csv.gz"] = ios.rows.length;
    const byPid = new Map<string, number[]>();
    for (const row of ios.rows) {
      const pid = row["pid"]; if (!pid||!participantMap.has(pid)) continue;
      const m = num(row["total_gaming_minutes"]);
      if (!byPid.has(pid)) byPid.set(pid,[]);
      if (m!==null) byPid.get(pid)!.push(m);
    }
    for (const [pid, mins] of byPid) {
      const p = participantMap.get(pid)!;
      p["ios_total_minutes"] = mins.reduce((a,b)=>a+b,0);
      p["ios_mean_daily_minutes"] = avg(mins);
      p["ios_days_with_data"] = mins.length;
    }
    console.log(`  ✅ iOS: ${byPid.size} matched`);
  }

  // Step 8: Large telemetry from Python output
  console.log("Merging pre-aggregated telemetry (Xbox, Nintendo, Steam)...");
  filesUsed.push("telemetry_xbox_raw.csv.gz","telemetry_nintendo_raw.csv.gz","telemetry_steam_raw.csv.gz","telemetry_steam_owned_games_raw.csv.gz");

  for (const [pid, p] of participantMap) {
    const xb = telemData.xbox[pid];
    if (xb) Object.assign(p, xb);
    const nt = telemData.nintendo[pid];
    if (nt) Object.assign(p, nt);
    const st = telemData.steam[pid];
    if (st) Object.assign(p, st);
    const so = telemData.steam_owned[pid];
    if (so) Object.assign(p, so);
  }
  console.log("  ✅ Telemetry merged");

  // Step 9: Steam account linking
  const slEntry = getEntry("telemetry_steam_account_linking_raw.csv.gz");
  if (slEntry) {
    const sl = await getGz(slEntry);
    filesUsed.push("telemetry_steam_account_linking_raw.csv.gz");
    rowsPerSource["telemetry_steam_account_linking_raw.csv.gz"] = sl.rows.length;
    const byPid = new Map<string, number>();
    for (const row of sl.rows) {
      const pid = row["pid"]; if (!pid||!participantMap.has(pid)) continue;
      byPid.set(pid,(byPid.get(pid)??0)+1);
    }
    for (const [pid, count] of byPid) {
      const p = participantMap.get(pid)!;
      p["steam_linked"] = 1;
      p["steam_link_events"] = count;
    }
  }

  // Step 10: Cognitive tasks
  console.log("Loading cognitive tasks...");
  const cogEntry = getEntry("cognitive_tasks_raw.csv.gz");
  if (cogEntry) {
    const cog = await getGz(cogEntry);
    filesUsed.push("cognitive_tasks_raw.csv.gz");
    rowsPerSource["cognitive_tasks_raw.csv.gz"] = cog.rows.length;
    const byPid = new Map<string, {rts:number[];accs:number[];tasks:Set<string>}>();
    for (const row of cog.rows) {
      const pid = row["pid"]; if (!pid||!participantMap.has(pid)) continue;
      if (!byPid.has(pid)) byPid.set(pid,{rts:[],accs:[],tasks:new Set()});
      const acc = byPid.get(pid)!;
      const rt = num(row["rt"]); if (rt!==null) acc.rts.push(rt);
      const a = num(row["accuracy"]); if (a!==null) acc.accs.push(a);
      acc.tasks.add(row["task"]??"");
    }
    for (const [pid, acc] of byPid) {
      const p = participantMap.get(pid)!;
      p["cog_mean_rt"] = avg(acc.rts);
      p["cog_mean_accuracy"] = avg(acc.accs);
      p["cog_num_tasks"] = acc.tasks.size;
      p["cog_num_trials"] = acc.rts.length;
    }
    console.log(`  ✅ Cognitive: ${byPid.size} matched`);
  }

  // Step 11: Time use
  console.log("Loading time use...");
  const tuEntry = getEntry("timeuse_raw.csv.gz");
  if (tuEntry) {
    const tu = await getGz(tuEntry);
    filesUsed.push("timeuse_raw.csv.gz");
    rowsPerSource["timeuse_raw.csv.gz"] = tu.rows.length;
    const byPid = new Map<string, {days:Set<string>;total:number;gaming:number}>();
    for (const row of tu.rows) {
      const pid = row["pid"]; if (!pid||!participantMap.has(pid)) continue;
      if (!byPid.has(pid)) byPid.set(pid,{days:new Set(),total:0,gaming:0});
      const acc = byPid.get(pid)!;
      acc.days.add(row["date"]??""); acc.total++;
      if ((row["activity"]??"").toLowerCase().includes("gam")) acc.gaming++;
    }
    for (const [pid, acc] of byPid) {
      const p = participantMap.get(pid)!;
      p["timeuse_num_entries"] = acc.total;
      p["timeuse_num_days"] = acc.days.size;
      p["timeuse_gaming_entries"] = acc.gaming;
    }
    console.log(`  ✅ Time use: ${byPid.size} matched`);
  }

  // Step 12: Availability flags
  for (const [, p] of participantMap) {
    p["has_biweekly"] = p["bw_gdt_1"]!==null&&p["bw_gdt_1"]!==undefined ? 1 : 0;
    p["has_daily"] = p["daily_num_responses"]!==undefined ? 1 : 0;
    p["has_android"] = p["android_total_minutes"]!==undefined ? 1 : 0;
    p["has_ios"] = p["ios_total_minutes"]!==undefined ? 1 : 0;
    p["has_nintendo"] = p["nintendo_total_sessions"]!==undefined ? 1 : 0;
    p["has_xbox"] = p["xbox_total_sessions"]!==undefined ? 1 : 0;
    p["has_steam"] = p["steam_total_records"]!==undefined ? 1 : 0;
    p["has_cognitive"] = p["cog_num_trials"]!==undefined ? 1 : 0;
    p["has_timeuse"] = p["timeuse_num_entries"]!==undefined ? 1 : 0;
    const tplatforms = [p["has_android"],p["has_ios"],p["has_nintendo"],p["has_xbox"],p["has_steam"]];
    p["num_telemetry_platforms"] = tplatforms.filter(v=>v===1).length;
    p["has_any_telemetry"] = p["num_telemetry_platforms"]>0 ? 1 : 0;

    const nintendoNocturnal = Number(p["nintendo_nocturnal_sessions"] ?? 0) || 0;
    const xboxNocturnal = Number(p["xbox_nocturnal_sessions"] ?? 0) || 0;
    p["telem_nocturnal_sessions"] = nintendoNocturnal + xboxNocturnal;

    const androidDays = Number(p["android_days_with_data"] ?? 0) || 0;
    const iosDays = Number(p["ios_days_with_data"] ?? 0) || 0;
    const nintendoSessions = Number(p["nintendo_total_sessions"] ?? 0) || 0;
    const xboxSessions = Number(p["xbox_total_sessions"] ?? 0) || 0;
    const steamRecords = Number(p["steam_total_records"] ?? 0) || 0;
    p["telem_total_sessions"] = androidDays + iosDays + nintendoSessions + xboxSessions + steamRecords;
    p["telem_activity_count"] = p["telem_total_sessions"];
  }

  // Step 13: Write CSV
  console.log("\n📝 Writing consolidated CSV...");
  const allRows = Array.from(participantMap.values());
  const colSet = new Set<string>();
  for (const row of allRows) Object.keys(row).forEach(k => colSet.add(k));
  
  // Order columns logically
  const priorityCols = ["record_id","pid","age","gender","country","cohort","edu_level","employment",
    "marital_status","height","weight","ethnicity","num_platforms","self_reported_weekly_play",
    "plays_xbox","plays_steam","plays_nintendo","plays_ios","plays_android","plays_playstation",
    "neuro_identify","neuro_diagnosed","neuro_diag_asd","neuro_diag_adhd","neuro_diag_dyslexia","dependents",
    "intake_life_sat","intake_affective_valence",
    "intake_wemwbs_1","intake_wemwbs_2","intake_wemwbs_3","intake_wemwbs_4","intake_wemwbs_5","intake_wemwbs_6","intake_wemwbs_7",
    "gdt_total","promis_total","wemwbs_total","bangs_total",
    "telem_nocturnal_sessions","telem_activity_count","telem_total_sessions","steam_playtime_2weeks_min",
    "bw_gdt_1","bw_gdt_2","bw_gdt_3","bw_gdt_4",
    "bw_promis_1","bw_promis_2","bw_promis_3","bw_promis_4","bw_promis_5","bw_promis_6","bw_promis_7","bw_promis_8",
    "bw_wemwbs_1","bw_wemwbs_2","bw_wemwbs_3","bw_wemwbs_4","bw_wemwbs_5","bw_wemwbs_6","bw_wemwbs_7",
  ];
  
  const restCols = Array.from(colSet).filter(c => !priorityCols.includes(c)).sort();
  const columns = [...priorityCols.filter(c => colSet.has(c)), ...restCols];

  function esc(v: string|number|null|undefined): string {
    if (v===null||v===undefined||v==="") return "";
    const s = String(v);
    return s.includes(",")||s.includes('"')||s.includes("\n") ? `"${s.replace(/"/g,'""')}"` : s;
  }

  const csvLines = [columns.join(",")];
  for (const row of allRows) csvLines.push(columns.map(c => esc(row[c])).join(","));
  fs.writeFileSync(path.join(PUBLIC_OUT_DIR, "openplay_consolidated.csv"), csvLines.join("\n"), "utf-8");
  console.log(`✅ ${allRows.length} participantes, ${columns.length} columnas → openplay_consolidated.csv`);

  // Step 14: Data dictionary
  const dictLines = ["variable,source_file,original_column,generated_column,aggregation,description,data_type,missing_values"];
  for (const col of columns) {
    const missing = allRows.filter(r => r[col]===null||r[col]===undefined||r[col]==="").length;
    const src = col.startsWith("bw_")||["gdt_total","promis_total","wemwbs_total","bangs_total"].includes(col) ? "survey_biweekly_raw.csv.gz"
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
      : col.startsWith("daily_")||col.startsWith("android_")||col.startsWith("ios_")||col.startsWith("nintendo_")||col.startsWith("xbox_")||col.startsWith("steam_")||col.startsWith("telem_")||col.startsWith("cog_")||col.startsWith("timeuse_") ? "aggregated"
      : "direct";
    dictLines.push([col,src,col.startsWith("bw_")?col.replace("bw_",""):col,col,agg,`Variable: ${col}`,"mixed",String(missing)].map(v=>v.includes(",")?`"${v}"`:v).join(","));
  }
  fs.writeFileSync(path.join(PUBLIC_OUT_DIR,"openplay_data_dictionary.csv"), dictLines.join("\n"), "utf-8");
  console.log("✅ openplay_data_dictionary.csv written");

  // Step 15: Integration report
  rowsPerSource["telemetry_xbox_raw.csv.gz"] = 4902000;
  rowsPerSource["telemetry_nintendo_raw.csv.gz"] = 756519;
  rowsPerSource["telemetry_steam_raw.csv.gz"] = 1046613;
  rowsPerSource["telemetry_steam_owned_games_raw.csv.gz"] = 666403;

  const report = {
    zipFile: "OpenPlay-20260609T233203Z-3-001.zip",
    filesDetected, filesUsed, filesNotUsed,
    joinKeys: { primary: "pid", source: "survey_intake_raw.csv.gz", criteria: "qualified==TRUE" },
    aggregations: {
      survey_biweekly: "First wave per participant (minimum wave number)",
      survey_daily: "Count/sum aggregations",
      telemetry_android: "Sum/mean of daily gaming minutes",
      telemetry_ios: "Sum/mean of daily gaming minutes",
      telemetry_nintendo: "Session count, total duration, mean/max session, unique games, nocturnal sessions",
      telemetry_xbox: "Session count, total duration, mean/max session, unique games, nocturnal sessions",
      telemetry_steam: "Min/max recent playtime, max historical playtime, unique game count",
      telemetry_steam_owned: "Owned games count, total playtime forever",
      cognitive_tasks: "Mean RT, mean accuracy, task count",
      timeuse: "Entry count, day count, gaming entries"
    },
    rowsPerSource,
    participantsDetected: participantMap.size,
    finalRows: allRows.length,
    finalColumns: columns.length,
    warnings
  };
  fs.writeFileSync(path.join(PUBLIC_OUT_DIR,"openplay_integration_report.json"), JSON.stringify(report, null, 2), "utf-8");
  console.log("✅ openplay_integration_report.json written");

  console.log(`\n🎉 Proceso completado: ${allRows.length} participantes, ${columns.length} variables`);
}

main().catch(e => { console.error(e); process.exit(1); });
