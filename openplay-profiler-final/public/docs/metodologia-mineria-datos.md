# Guia metodologica - OpenPlay Profiler

## Objetivo

El proyecto analiza el dataset OpenPlay para identificar perfiles exploratorios de jugadores a partir de variables de videojuegos, bienestar, telemetria, cognicion y uso del tiempo.

La meta no es diagnosticar participantes ni predecir una etiqueta clinica. El resultado esperado es una segmentacion descriptiva que permita formular hipotesis sobre patrones de juego y bienestar.

## Enfoque de inteligencia de negocios

Desde BI, el dashboard responde preguntas de decision:

- Que tan completo y confiable es el dataset para analizar jugadores.
- Que fuentes aportan mas cobertura: encuestas, telemetria, tareas cognitivas o uso del tiempo.
- Que variables tienen mayor riesgo de sesgo por faltantes.
- Que segmentos de participantes aparecen cuando se combinan bienestar, riesgo, actividad y telemetria.
- Que variables explican la diferencia entre perfiles.

El valor del sistema no esta solo en generar graficos, sino en convertir datos heterogeneos en evidencia accionable: cobertura, patrones, atipicos, perfiles y advertencias metodologicas.

## Preguntas guia y tareas de analisis

Las tareas del sistema se derivan de preguntas concretas que pueden responderse dentro de la interfaz. No se proponen tareas que no tengan una vista, variable o grafico asociado en el proyecto.

- **P1. Que fuentes de OpenPlay tienen suficiente cobertura para sostener una interpretacion visual y cuales deben leerse con cautela?**
  - **T1. Evaluar cobertura y calidad del dataset.** Se responde con las vistas Datos, Profiling, Filtros y Validacion, usando banderas como `has_steam`, `has_xbox`, `has_nintendo`, `has_android`, `has_ios`, `has_cognitive` y `has_timeuse`.

- **P2. Que relaciones entre telemetria, bienestar, riesgo y uso del tiempo explican diferencias entre participantes?**
  - **T2. Seleccionar el vector de caracteristicas y explorar relaciones entre variables originales.** Se responde con Vector, Profiling, Encuestas y Bivariado, por ejemplo comparando `telem_total_sessions` con `telem_nocturnal_sessions`.

- **P3. Que perfiles exploratorios aparecen al combinar el vector de caracteristicas con reduccion dimensional y clustering, y como se validan con variables originales?**
  - **T3. Proyectar y agrupar participantes para ubicar perfiles exploratorios.** Se responde con PCA/t-SNE/UMAP y clustering.
  - **T4. Validar e interpretar perfiles con variables originales, filtros y vistas coordinadas.** Se responde con Validacion, Filtros, Encuestas, perfiles estandarizados y cobertura por fuente.

## Pipeline de mineria de datos

1. Carga del dataset consolidado `openplay_consolidated.csv`.
2. Profiling de variables: tipo de dato, cobertura, faltantes, distribucion y valores frecuentes.
3. Seleccion del vector de caracteristicas.
4. Evaluacion del vector: variables numericas disponibles, faltantes, casos completos y redundancia por correlacion.
5. Estandarizacion e imputacion de valores faltantes.
6. Reduccion dimensional con PCA, UMAP o t-SNE.
7. Clustering sobre la proyeccion 2D con K-means, jerarquico single-link o DBSCAN.
8. Interpretacion de clusters mediante variables originales.

## Vector recomendado

El vector integral recomendado combina:

- Base del participante: edad, numero de plataformas y cobertura de telemetria.
- Bienestar y riesgo: GDT, PROMIS, WEMWBS y BANGS.
- Telemetria: sesiones totales, sesiones nocturnas, tiempo de juego y juegos unicos.
- Actividad diaria: dias jugados y dias con estres reportado.
- Cognicion: precision media y tiempo de respuesta.
- Uso del tiempo: entradas relacionadas con videojuegos y dias registrados.

PCA, UMAP, t-SNE y clustering usan solo variables numericas. Las variables categoricas se usan para filtrar, comparar e interpretar, pero no entran directamente en la proyeccion.

## Criterios de calidad

Un vector es mas defendible cuando:

- Tiene al menos 5 variables numericas relevantes.
- Mantiene alta cobertura y suficientes casos completos.
- No depende de una sola familia de variables.
- Tiene redundancia controlada: pares muy correlacionados se reportan, pero no se eliminan automaticamente.
- Los clusters resultantes tienen tamanos razonables y diferencias interpretables en variables originales.

## Validacion del clustering

El clustering se evalua con cuatro criterios:

- Silhouette aproximado: mide si los puntos estan mas cerca de su grupo que de otros grupos. Valores cercanos a 1 son mejores; valores cercanos a 0 indican solapamiento.
- Cohesion media: distancia promedio al centroide del grupo. Mas baja significa grupos mas compactos.
- Separacion minima: distancia minima entre centroides. Mas alta sugiere grupos mejor separados.
- Balance de tamano: relacion entre el grupo mas pequeno y el mas grande. Valores muy bajos indican que el algoritmo podria estar separando atipicos en vez de perfiles comparables.

Estas metricas se calculan sobre la proyeccion 2D, no sobre todo el espacio original. Por eso deben complementarse con la interpretacion por variables originales.

## Notas sobre variables derivadas

`steam_playtime_2weeks_min` debe interpretarse solo despues de regenerar el dataset con el pipeline actualizado, porque versiones previas del CSV consolidado copiaban el maximo en esa columna. Por esa razon, el vector recomendado usa `steam_playtime_2weeks_max` y no depende del minimo reciente.

`telem_total_sessions` se conserva por compatibilidad con resultados existentes, pero mezcla dias con datos moviles, sesiones de consola y registros de Steam. Para conclusiones metodologicas es mejor describirlo como conteo agregado de actividad de telemetria o usar variables por plataforma.

## Interpretacion responsable

Los clusters son perfiles exploratorios. Un grupo debe describirse por sus variables diferenciales, por ejemplo: mayor actividad nocturna, mayor cobertura multiplataforma, menor registro de uso del tiempo o mayor malestar reportado.

No se deben presentar como diagnosticos, categorias psicologicas definitivas ni evidencia causal. La proyeccion 2D ayuda a explorar similitudes, pero las conclusiones se justifican con las variables originales y con las metricas de cobertura del vector.

## Guion recomendado para defender el proyecto

1. Presentar el problema: hay datos de juego y bienestar, pero estan distribuidos en varias fuentes y escalas.
2. Explicar el pipeline: integracion, profiling, vector, estandarizacion, reduccion dimensional, clustering e interpretacion.
3. Mostrar calidad del dato: participantes, variables, faltantes promedio y cobertura por fuente.
4. Justificar el vector: combina bienestar, riesgo, telemetria, cognicion y uso del tiempo.
5. Explicar PCA/UMAP/t-SNE: son herramientas para visualizar similitud, no para demostrar causalidad.
6. Ejecutar clustering y revisar metricas: silhouette, cohesion, separacion y balance.
7. Interpretar perfiles con variables originales, no solo por colores del grafico.
8. Cerrar con limitaciones: faltantes, sesgo de cobertura, variables derivadas y caracter exploratorio.

## Limitaciones y mejoras futuras

- Regenerar el CSV consolidado despues de cualquier cambio en el ETL para alinear datos publicos y codigo.
- Agregar tests unitarios para correlaciones, imputacion, PCA y agregaciones ETL.
- Mover t-SNE y calculos pesados a Web Worker si se analiza la muestra completa muchas veces.
- Evaluar clustering tambien en el espacio estandarizado original, no solo en la proyeccion 2D.
- Crear un diccionario de datos enriquecido con unidad, fuente, formula y descripcion semantica de cada variable.
