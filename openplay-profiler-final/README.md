# OpenPlay Profiler

Herramienta interactiva de Mineria de Datos para explorar el dataset OpenPlay, construir un vector de caracteristicas, proyectar participantes en 2D y analizar perfiles exploratorios mediante clustering.

El proyecto esta orientado a una entrega academica: prioriza trazabilidad del pipeline, interpretacion responsable y precision en el tratamiento de variables numericas, valores faltantes, correlaciones y resultados de reduccion dimensional.

## Objetivo analitico

Identificar perfiles exploratorios de jugadores combinando variables de comportamiento de juego, bienestar, telemetria, cognicion y uso del tiempo. Los clusters se interpretan como patrones descriptivos, no como diagnosticos clinicos ni conclusiones causales.

## Pipeline de Mineria de Datos

1. Carga del CSV consolidado o archivos fuente.
2. Profiling de columnas: tipos, faltantes, distribuciones y frecuencias.
3. Seleccion del vector de caracteristicas.
4. Evaluacion del vector: cantidad de variables numericas, cobertura, casos completos y redundancia por correlacion.
5. Estandarizacion e imputacion controlada.
6. Reduccion dimensional con PCA, UMAP o t-SNE.
7. K-means oficial sobre el vector original estandarizado; PCA/UMAP/t-SNE muestran esas mismas etiquetas.
8. Comparaciones 2D opcionales con jerarquico single-link o DBSCAN.
9. Interpretacion y validacion de grupos usando variables originales.

## Requisitos

- Node.js 18 o superior
- Python 3.9 o superior, solo para regenerar el dataset consolidado
- npm

## Instalacion

```bash
npm install
```

## Ejecutar la app

```bash
npm run dev
```

Luego abre:

```text
http://localhost:3000
```

La aplicacion carga por defecto:

```text
public/data/openplay_consolidated.csv
```

## Regenerar datos consolidados

Los datos fuente grandes deben vivir fuera de `public/`, para que no queden expuestos al desplegar la aplicacion.

Usa una de estas opciones:

```text
data/OpenPlay-20260609T233203Z-3-001.zip
```

o la carpeta extraida:

```text
data/OpenPlay/
```

Despues ejecuta:

```bash
npm run build:data
```

El script genera archivos publicos ligeros en:

```text
public/data/openplay_consolidated.csv
public/data/openplay_data_dictionary.csv
public/data/openplay_integration_report.json
```

Tambien usa una cache local privada:

```text
data/telemetry_aggregated.json
```

El proceso ejecuta automáticamente la minimización de la copia pública. La política,
las columnas excluidas y el procedimiento de publicación están documentados en
[`docs/PRIVACY.md`](docs/PRIVACY.md). Los datos fuente no están cubiertos por una
licencia de código y no deben redistribuirse sin autorización explícita.

La preparación analítica para la exposición, los recorridos cognitivos, el guion de
ocho minutos y las respuestas a posibles preguntas están en
[`docs/EVALUACION_FINAL.md`](docs/EVALUACION_FINAL.md).

Las definiciones en lenguaje sencillo y la explicación honesta del uso de IA están
en [`docs/CONCEPTOS_PARA_DEFENSA.md`](docs/CONCEPTOS_PARA_DEFENSA.md).

La clasificación de T1--T4 y el inventario de todos los gráficos con el marco
Why--What--How de Munzner están en
[`docs/TAREAS_MUNZNER.md`](docs/TAREAS_MUNZNER.md).

El recorrido exacto de ocho minutos, con el texto oral y los clics del dashboard,
está en [`README_EXPOSICION.md`](README_EXPOSICION.md).

## Funcionalidades

- Carga de CSV, CSV.GZ o ZIP desde la interfaz.
- Carga rapida del CSV consolidado precompilado.
- Resumen BI con cobertura por fuente y diagnostico inicial del dataset.
- Profiling univariado con estadisticas, histogramas, boxplots y frecuencias.
- Analisis bivariado con scatter plot, correlacion y color por variable.
- Deteccion de grupos de encuestas e indices.
- Seleccion de variables para construir vectores de caracteristicas.
- Evaluacion del vector con cobertura, casos completos y correlaciones altas.
- Filtros numericos y categoricos.
- PCA, UMAP y t-SNE con descarga de coordenadas.
- Clustering 2D e interpretacion de perfiles mediante variables originales.
- Metricas de clustering: silhouette aproximado, cohesion, separacion y balance de tamanos.
- Seleccion de participantes y comparacion visual.

## Criterios de precision implementados

- Conversion numerica estricta para evitar que cadenas parcialmente numericas entren al analisis.
- Estandarizacion antes de PCA, UMAP y t-SNE para comparar variables con escalas distintas.
- PCA deterministico para que la proyeccion sea reproducible.
- t-SNE con calculo corregido de perplejidad y semilla fija para resultados repetibles.
- Invalidacion automatica de proyecciones cuando cambia el dataset, el vector o los filtros.
- Lectura de clustering con metricas cuantitativas, no solo inspeccion visual.
- Advertencia metodologica: las variables categoricas sirven para filtrar e interpretar, pero no entran directamente a PCA/UMAP/t-SNE.

## Estructura

```text
app/                         Interfaz principal de Next.js
components/                  Componentes de visualizacion y analisis
lib/                         Utilidades de datos, estado y algoritmos
scripts/build-openplay-dataset.ts
scripts/preprocess-large.py
public/data/                 Archivos publicos consumidos por la app
data/                        Datos fuente privados e ignorados por Git
```

## Notas

- `data/` esta ignorado por Git porque contiene fuentes grandes o sensibles.
- `public/data/OpenPlay/` no debe usarse para datos crudos en despliegue.
- t-SNE sobre muchos participantes puede tardar varios minutos en navegador.
- La guia metodologica de la app esta en `public/docs/metodologia-mineria-datos.md`.
