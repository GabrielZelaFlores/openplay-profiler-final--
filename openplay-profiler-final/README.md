# OpenPlay Profiler

Herramienta interactiva para explorar, perfilar y reducir dimensionalidad sobre datos de OpenPlay.

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

## Funcionalidades

- Carga de CSV, CSV.GZ o ZIP desde la interfaz.
- Carga rapida del CSV consolidado precompilado.
- Profiling univariado con estadisticas, histogramas, boxplots y frecuencias.
- Analisis bivariado con scatter plot, correlacion y color por variable.
- Deteccion de grupos de encuestas e indices.
- Seleccion de variables para construir vectores de caracteristicas.
- Filtros numericos y categoricos.
- PCA, UMAP y t-SNE con descarga de coordenadas.
- Seleccion de participantes y comparacion visual.

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
