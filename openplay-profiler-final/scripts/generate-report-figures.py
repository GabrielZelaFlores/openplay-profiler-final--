from pathlib import Path
import shutil
import json

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import umap
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data" / "openplay_consolidated.csv"
OUT = ROOT / "informe" / "figures"
PUBLIC_OUT = ROOT / "public" / "docs" / "figures"
OUT.mkdir(parents=True, exist_ok=True)
PUBLIC_OUT.mkdir(parents=True, exist_ok=True)

plt.rcParams.update({
    "figure.dpi": 140,
    "savefig.dpi": 220,
    "font.size": 9,
    "axes.titlesize": 11,
    "axes.labelsize": 9,
})

df = pd.read_csv(DATA)
analysis = json.loads((OUT / "analysis_run.json").read_text(encoding="utf-8"))
features = analysis["config"]["features"]
X = df[features].apply(pd.to_numeric, errors="coerce")
Z = StandardScaler().fit_transform(SimpleImputer(strategy="median").fit_transform(X))

pca = PCA(n_components=2, random_state=42)
coords = pca.fit_transform(Z)
umap_coords = umap.UMAP(
    n_components=2,
    n_neighbors=15,
    min_dist=0.1,
    metric="euclidean",
    random_state=42,
).fit_transform(Z)

labels_by_id = {str(key): value for key, value in analysis["labels"].items()}
labels = np.array([labels_by_id[str(record_id)] for record_id in df["record_id"]])
labels_pca2d = KMeans(n_clusters=4, random_state=42, n_init=50).fit_predict(coords)
work = df.copy()
work["cluster"] = labels
work["cluster_pca2d"] = labels_pca2d
work["pc1"] = coords[:, 0]
work["pc2"] = coords[:, 1]
work["umap1"] = umap_coords[:, 0]
work["umap2"] = umap_coords[:, 1]

zdf = pd.DataFrame(Z, columns=features)
zdf["cluster"] = labels
profile = zdf.groupby("cluster")[features].mean()

cluster_names = {
    cluster["label"]: f'C{cluster["label"]}: {cluster["name"].lower()}'
    for cluster in analysis["clusters"]
}

colors = {
    0: "#4f647f",
    1: "#9b4d5f",
    2: "#5f725c",
    3: "#9b6f45",
}


def savefig(name: str) -> None:
    plt.tight_layout()
    plt.savefig(OUT / name, bbox_inches="tight")
    plt.close()
    shutil.copy2(OUT / name, PUBLIC_OUT / name)


# Figura 1: cobertura por fuente.
flags = [
    ("has_steam", "Steam"),
    ("has_xbox", "Xbox"),
    ("has_nintendo", "Nintendo"),
    ("has_android", "Android"),
    ("has_ios", "iOS"),
    ("has_cognitive", "Cognicion"),
    ("has_timeuse", "Uso tiempo"),
    ("has_daily", "Daily"),
    ("has_biweekly", "Biweekly"),
]
coverage = []
for col, label in flags:
    if col in df.columns:
        values = pd.to_numeric(df[col], errors="coerce").fillna(0)
        coverage.append((label, values.mean() * 100))

coverage = pd.DataFrame(coverage, columns=["Fuente", "Cobertura"]).sort_values("Cobertura", ascending=True)
plt.figure(figsize=(7.6, 4.4))
plt.barh(coverage["Fuente"], coverage["Cobertura"], color="#4f647f")
for y, value in enumerate(coverage["Cobertura"]):
    plt.text(value + 1, y, f"{value:.1f}%", va="center", fontsize=8)
plt.xlim(0, 105)
plt.xlabel("Participantes con datos (%)")
plt.title("Cobertura por fuente del dataset OpenPlay")
plt.grid(axis="x", alpha=0.2)
savefig("fig01_cobertura_fuentes.png")


# Figura 2: proyeccion PCA con clusters calculados sobre el vector estandarizado.
plt.figure(figsize=(7.2, 5.2))
for cl in sorted(work["cluster"].unique()):
    part = work[work["cluster"] == cl]
    plt.scatter(part["pc1"], part["pc2"], s=13, alpha=0.68, color=colors[cl], label=f"{cluster_names[cl]} (n={len(part)})")
plt.axhline(0, color="#d1d5db", linewidth=0.8)
plt.axvline(0, color="#d1d5db", linewidth=0.8)
plt.xlabel(f"PCA 1 ({pca.explained_variance_ratio_[0]*100:.1f}% var.)")
plt.ylabel(f"PCA 2 ({pca.explained_variance_ratio_[1]*100:.1f}% var.)")
plt.title("PCA como mapa visual de perfiles calculados en el vector original")
plt.legend(loc="best", fontsize=7, frameon=True)
plt.grid(alpha=0.15)
savefig("fig02_pca_clusters.png")


# Figura 2b: clustering calculado directamente sobre el espacio PCA 2D.
plt.figure(figsize=(7.2, 5.2))
for cl in sorted(work["cluster_pca2d"].unique()):
    part = work[work["cluster_pca2d"] == cl]
    plt.scatter(part["pc1"], part["pc2"], s=13, alpha=0.68, color=colors[cl], label=f"Cluster PCA 2D {cl + 1} (n={len(part)})")
plt.axhline(0, color="#d1d5db", linewidth=0.8)
plt.axvline(0, color="#d1d5db", linewidth=0.8)
plt.xlabel(f"PCA 1 ({pca.explained_variance_ratio_[0]*100:.1f}% var.)")
plt.ylabel(f"PCA 2 ({pca.explained_variance_ratio_[1]*100:.1f}% var.)")
plt.title("K-means aplicado solo sobre las coordenadas PCA 2D")
plt.legend(loc="best", fontsize=7, frameon=True)
plt.grid(alpha=0.15)
savefig("fig02b_pca_2d_clusters.png")


# Figura 2c: UMAP con los mismos clusters calculados sobre el vector estandarizado.
plt.figure(figsize=(7.2, 5.2))
for cl in sorted(work["cluster"].unique()):
    part = work[work["cluster"] == cl]
    plt.scatter(part["umap1"], part["umap2"], s=13, alpha=0.68, color=colors[cl], label=f"{cluster_names[cl]} (n={len(part)})")
plt.xlabel("UMAP 1")
plt.ylabel("UMAP 2")
plt.title("UMAP como vista complementaria de los perfiles del vector original")
plt.legend(loc="best", fontsize=7, frameon=True)
plt.grid(alpha=0.15)
savefig("fig02c_umap_clusters.png")


# Figura 3: perfil estandarizado de clusters.
profile_cols = [
    "num_platforms",
    "num_telemetry_platforms",
    "telem_nocturnal_sessions",
    "telem_total_sessions",
    "timeuse_gaming_entries",
    "timeuse_num_days",
    "promis_total",
    "wemwbs_total",
    "gdt_total",
    "bangs_total",
    "cog_mean_rt",
]
profile_cols = [col for col in profile_cols if col in profile.columns]
matrix = profile[profile_cols].to_numpy()
plt.figure(figsize=(9.2, 3.8))
im = plt.imshow(matrix, cmap="RdBu_r", vmin=-1.5, vmax=1.5, aspect="auto")
plt.colorbar(im, label="Media estandarizada del cluster")
plt.yticks(range(len(profile.index)), [f"{cluster_names[i]} (n={(labels == i).sum()})" for i in profile.index])
plt.xticks(range(len(profile_cols)), profile_cols, rotation=35, ha="right")
plt.title("Variables que diferencian a cada perfil exploratorio")
for i in range(matrix.shape[0]):
    for j in range(matrix.shape[1]):
        plt.text(j, i, f"{matrix[i, j]:.1f}", ha="center", va="center", fontsize=6, color="black")
savefig("fig03_perfil_clusters.png")


# Figura 4: intensidad nocturna vs actividad total.
plt.figure(figsize=(7.2, 5.0))
for cl in sorted(work["cluster"].unique()):
    part = work[work["cluster"] == cl]
    x = pd.to_numeric(part["telem_total_sessions"], errors="coerce").fillna(0)
    y = pd.to_numeric(part["telem_nocturnal_sessions"], errors="coerce").fillna(0)
    plt.scatter(np.log1p(x), np.log1p(y), s=14, alpha=0.65, color=colors[cl], label=cluster_names[cl])
plt.xlabel("log(1 + sesiones totales de telemetria)")
plt.ylabel("log(1 + sesiones nocturnas)")
plt.title("Validacion del perfil de alta intensidad nocturna")
plt.legend(loc="best", fontsize=7, frameon=True)
plt.grid(alpha=0.18)
savefig("fig04_intensidad_nocturna.png")


# Figura 5: bienestar/riesgo por perfil.
well_cols = ["promis_total", "wemwbs_total", "gdt_total", "bangs_total"]
well_cols = [col for col in well_cols if col in profile.columns]
x = np.arange(len(well_cols))
width = 0.18
plt.figure(figsize=(8.2, 4.5))
for idx, cl in enumerate(sorted(profile.index)):
    plt.bar(x + (idx - 1.5) * width, profile.loc[cl, well_cols], width, label=cluster_names[cl], color=colors[cl])
plt.axhline(0, color="#111827", linewidth=0.8)
plt.xticks(x, well_cols, rotation=20, ha="right")
plt.ylabel("Media estandarizada")
plt.title("Contraste de bienestar y riesgo por perfil")
plt.legend(fontsize=7, frameon=True)
plt.grid(axis="y", alpha=0.2)
savefig("fig05_bienestar_riesgo.png")


# Figura 6: cobertura por cluster.
cluster_flag_cols = ["has_steam", "has_xbox", "has_nintendo", "has_cognitive", "has_timeuse", "has_daily", "has_biweekly"]
cluster_flag_cols = [col for col in cluster_flag_cols if col in work.columns]
coverage_by_cluster = []
for cl in sorted(work["cluster"].unique()):
    row = []
    group = work[work["cluster"] == cl]
    for col in cluster_flag_cols:
        row.append(pd.to_numeric(group[col], errors="coerce").fillna(0).mean() * 100)
    coverage_by_cluster.append(row)
coverage_by_cluster = np.array(coverage_by_cluster)

x = np.arange(len(cluster_flag_cols))
width = 0.18
plt.figure(figsize=(9.2, 4.7))
for idx, cl in enumerate(sorted(work["cluster"].unique())):
    plt.bar(x + (idx - 1.5) * width, coverage_by_cluster[idx], width, label=cluster_names[cl], color=colors[cl])
plt.xticks(x, [col.replace("has_", "") for col in cluster_flag_cols], rotation=25, ha="right")
plt.ylabel("Cobertura dentro del cluster (%)")
plt.title("Cobertura de fuentes por perfil exploratorio")
plt.legend(fontsize=7, frameon=True)
plt.grid(axis="y", alpha=0.2)
savefig("fig06_cobertura_por_cluster.png")


summary = work.groupby("cluster").agg(
    participantes=("record_id", "count"),
    sesiones_nocturnas=("telem_nocturnal_sessions", "mean"),
    sesiones_totales=("telem_total_sessions", "mean"),
    plataformas=("num_platforms", "mean"),
    plataformas_telemetria=("num_telemetry_platforms", "mean"),
    dias_uso_tiempo=("timeuse_num_days", "mean"),
    entradas_gaming=("timeuse_gaming_entries", "mean"),
    promis=("promis_total", "mean"),
    wemwbs=("wemwbs_total", "mean"),
    gdt=("gdt_total", "mean"),
)
summary.to_csv(OUT / "cluster_summary.csv")
print(f"Figuras generadas en {OUT}")
print(summary.round(2).to_string())
