#!/usr/bin/env python3
"""
Preprocess large telemetry files and output aggregated JSON.
Called from build-openplay-dataset.ts for files too large for JS.
"""
import sys, os, gzip, csv, json, re
from collections import defaultdict

ZIP_PATH = sys.argv[1] if len(sys.argv) > 1 else "data/OpenPlay-20260609T233203Z-3-001.zip"
OUT_DIR = sys.argv[2] if len(sys.argv) > 2 else "data"

import zipfile

class FolderSource:
    def __init__(self, folder_path):
        self.folder_path = folder_path

    def open(self, name):
        return open(os.path.join(self.folder_path, os.path.basename(name)), "rb")

def process_xbox(zf):
    print("Processing Xbox telemetry...", flush=True)
    pid_data = defaultdict(lambda: {"durs": [], "nocturnal": 0, "games": set()})
    with zf.open("OpenPlay/telemetry_xbox_raw.csv.gz") as raw:
        with gzip.open(raw, "rt", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                pid = row.get("pid", "")
                if not pid: continue
                acc = pid_data[pid]
                try: d = float(row["duration"]); acc["durs"].append(d)
                except: pass
                start = row.get("session_start", "")
                m = re.search(r"T(\d{2}):", start)
                if m:
                    h = int(m.group(1))
                    if h < 6 or h >= 22: acc["nocturnal"] += 1
                acc["games"].add(row.get("title_id", ""))
    result = {}
    for pid, acc in pid_data.items():
        durs = acc["durs"]
        result[pid] = {
            "xbox_total_sessions": len(durs),
            "xbox_total_duration_min": round(sum(durs), 3),
            "xbox_mean_session_min": round(sum(durs)/len(durs), 3) if durs else None,
            "xbox_max_session_min": round(max(durs), 3) if durs else None,
            "xbox_unique_games": len(acc["games"]),
            "xbox_nocturnal_sessions": acc["nocturnal"],
        }
    print(f"  Xbox: {len(result)} participants")
    return result

def process_steam(zf):
    print("Processing Steam raw telemetry...", flush=True)
    pid_data = defaultdict(lambda: {"minPt2w": None, "maxPt2w": None, "maxPtF": None, "games": set(), "count": 0})
    with zf.open("OpenPlay/telemetry_steam_raw.csv.gz") as raw:
        with gzip.open(raw, "rt", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                pid = row.get("pid", "")
                if not pid: continue
                acc = pid_data[pid]
                acc["count"] += 1
                try:
                    pt2w = float(row["playtime_2weeks"])
                    acc["minPt2w"] = pt2w if acc["minPt2w"] is None else min(acc["minPt2w"], pt2w)
                    acc["maxPt2w"] = pt2w if acc["maxPt2w"] is None else max(acc["maxPt2w"], pt2w)
                except: pass
                try:
                    ptF = float(row["playtime_forever"])
                    acc["maxPtF"] = ptF if acc["maxPtF"] is None else max(acc["maxPtF"], ptF)
                except: pass
                acc["games"].add(row.get("title_id", ""))
    result = {}
    for pid, acc in pid_data.items():
        result[pid] = {
            "steam_total_records": acc["count"],
            "steam_playtime_2weeks_min": round(acc["minPt2w"], 3) if acc["minPt2w"] is not None else None,
            "steam_playtime_2weeks_max": round(acc["maxPt2w"], 3) if acc["maxPt2w"] is not None else None,
            "steam_playtime_forever_max": round(acc["maxPtF"], 3) if acc["maxPtF"] is not None else None,
            "steam_unique_games": len(acc["games"]),
        }
    print(f"  Steam: {len(result)} participants")
    return result

def process_steam_owned(zf):
    print("Processing Steam owned games...", flush=True)
    pid_data = defaultdict(lambda: {"count": 0, "total_ptF": 0})
    with zf.open("OpenPlay/telemetry_steam_owned_games_raw.csv.gz") as raw:
        with gzip.open(raw, "rt", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                pid = row.get("pid", "")
                if not pid: continue
                acc = pid_data[pid]
                acc["count"] += 1
                try: ptF = float(row["playtime_forever"]); acc["total_ptF"] += ptF
                except: pass
    result = {}
    for pid, acc in pid_data.items():
        result[pid] = {
            "steam_owned_games_count": acc["count"],
            "steam_owned_total_playtime": round(acc["total_ptF"], 3),
        }
    print(f"  Steam owned: {len(result)} participants")
    return result

def process_nintendo(zf):
    print("Processing Nintendo telemetry...", flush=True)
    pid_data = defaultdict(lambda: {"durs": [], "nocturnal": 0, "games": set()})
    with zf.open("OpenPlay/telemetry_nintendo_raw.csv.gz") as raw:
        with gzip.open(raw, "rt", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                pid = row.get("pid", "")
                if not pid: continue
                acc = pid_data[pid]
                try: d = float(row["duration"]); acc["durs"].append(d)
                except: pass
                start = row.get("session_start", "")
                m = re.search(r"T(\d{2}):", start)
                if m:
                    h = int(m.group(1))
                    if h < 6 or h >= 22: acc["nocturnal"] += 1
                acc["games"].add(row.get("title_id", ""))
    result = {}
    for pid, acc in pid_data.items():
        durs = acc["durs"]
        result[pid] = {
            "nintendo_total_sessions": len(durs),
            "nintendo_total_duration_min": round(sum(durs), 3),
            "nintendo_mean_session_min": round(sum(durs)/len(durs), 3) if durs else None,
            "nintendo_max_session_min": round(max(durs), 3) if durs else None,
            "nintendo_unique_games": len(acc["games"]),
            "nintendo_nocturnal_sessions": acc["nocturnal"],
        }
    print(f"  Nintendo: {len(result)} participants")
    return result

if os.path.isdir(ZIP_PATH):
    zf = FolderSource(ZIP_PATH)
    xbox = process_xbox(zf)
    steam = process_steam(zf)
    steam_owned = process_steam_owned(zf)
    nintendo = process_nintendo(zf)
else:
    with zipfile.ZipFile(ZIP_PATH) as zf:
        xbox = process_xbox(zf)
        steam = process_steam(zf)
        steam_owned = process_steam_owned(zf)
        nintendo = process_nintendo(zf)

output = {
    "xbox": xbox,
    "steam": steam,
    "steam_owned": steam_owned,
    "nintendo": nintendo,
}
out_path = os.path.join(OUT_DIR, "telemetry_aggregated.json")
with open(out_path, "w") as f:
    json.dump(output, f)
print(f"\n✅ Written to {out_path}")
