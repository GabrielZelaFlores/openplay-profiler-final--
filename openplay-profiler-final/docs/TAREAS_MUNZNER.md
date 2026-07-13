# Tareas del proyecto según Munzner

Este documento separa tres elementos que no deben confundirse durante la exposición:

- **Why:** qué conocimiento busca el usuario. Esta es la tarea analítica.
- **What:** qué datos o atributos se analizan.
- **How:** qué gráfico, método e interacción permiten completar la tarea.

Hacer clic, filtrar, cambiar ejes, ejecutar PCA o aplicar K-means pertenece al
**How**. La tarea debe expresarse como descubrir, identificar, comparar, resumir o
comprobar algo en los datos.

## Cadena principal de tareas

| ID | Tarea en palabras simples | Acción | Búsqueda | Consulta | Objetivo |
|---|---|---|---|---|---|
| T1 | Descubrir qué fuentes y variables tienen evidencia suficiente | Descubrir | Explorar | Resumir y comparar | Cobertura, faltantes, distribuciones y extremos |
| T2 | Comparar variables y construir un vector defendible | Descubrir y derivar | Explorar y localizar pares | Comparar | Correlaciones, distribuciones y similitud entre atributos |
| T3 | Explorar participantes para localizar perfiles y casos atípicos | Descubrir | Explorar | Resumir, identificar y comparar | Similitudes, grupos, separaciones y atípicos |
| T4 | Comprobar qué caracteriza un perfil y si depende de la cobertura | Comprobar | Localizar un perfil conocido | Comparar y resumir | Características, relaciones y efecto de la observabilidad |

La salida de una tarea alimenta la siguiente: T1 determina qué evidencia puede
usarse; T2 produce el vector; T3 genera candidatos a perfil; T4 comprueba o rechaza
su interpretación.

## Inventario de vistas y gráficos

| Vista o gráfico | What: datos representados | Why: tarea que apoya | How: representación e interacción | Lectura correcta |
|---|---|---|---|---|
| Resumen BI | Participantes, variables, faltantes y banderas `has_*` | T1: resumir y comparar cobertura | Indicadores y barras porcentuales | Una barra larga significa más participantes observados, no más juego |
| Tabla de datos | Filas y columnas consolidadas | T1: identificar valores y comprobar procedencia | Tabla, búsqueda y revisión de registros | Sirve para detalle, no para reconocer tendencias globales |
| Histograma | Valores de una variable numérica | T1/T2: resumir su distribución | Posición y longitud de barras por intervalos | Permite ver concentración, asimetría y muchos ceros |
| Boxplot | Una variable numérica | T1/T2: localizar extremos y resumir dispersión | Caja, mediana, bigotes y puntos extremos | Un punto extremo requiere revisión; no es automáticamente un error |
| Gráfico de violín | Una variable numérica | T1/T2: resumir la forma de la distribución | Ancho según densidad aproximada | Complementa al boxplot cuando interesa la forma |
| Barras categóricas | Frecuencia de categorías | T1/T2: comparar categorías | Longitud sobre una escala común | Muestra cantidad de casos por categoría |
| Dispersión bivariada | Dos variables originales y color opcional | T2/T4: comparar atributos y comprobar una relación | Punto por participante, cambio de ejes, color, hover y lazo | Cercanía o pendiente sugiere asociación; no demuestra causalidad |
| Perfil de una selección | Medias de puntos seleccionados frente al total | T4: comparar un subconjunto | Barras de diferencia estandarizada | Explica qué variables distinguen la selección |
| Desglose de encuestas | Ítems y totales GDT, PROMIS, WEMWBS y BANGS | T2: identificar variables disponibles | Lista desplegable, medias y selección | Organiza escalas; no convierte sus resultados en diagnóstico |
| Mapa de correlaciones | Variables numéricas activas | T2: comparar pares y localizar redundancia | Matriz con color divergente y hover | Correlación alta indica información parecida, no causa |
| Evaluación del vector | Cobertura, casos completos, tipos y pares correlacionados | T2: derivar un vector defendible | Indicadores, alertas y selección de variables | Justifica qué atributos entran a los modelos |
| Panel de filtros | Variables numéricas, categóricas y selección global | T1/T4: comprobar un patrón en una submuestra | Rangos, categorías y limpieza de filtros | Filtrar es una interacción; la tarea es comprobar si el patrón persiste |
| Proyección PCA/UMAP/t-SNE | Coordenadas 2D derivadas del vector | T3: explorar similitud y localizar separaciones | Nube de puntos, zoom, click, lazo y color | La forma localiza candidatos; debe volver a variables originales |
| Clustering oficial | Etiqueta calculada en el vector original estandarizado | T3: resumir participantes en grupos candidatos | K-means, color compartido, selección y tablas | PCA, Bivariado y Validación reutilizan las mismas etiquetas; el color no define el perfil por sí solo |
| Perfil del cluster | Medias del grupo frente a la media global | T4: comparar características de grupos | Barras positivas y negativas en desviaciones estándar | Es la explicación del grupo en variables originales |
| Robustez del clustering | Acuerdo entre semillas y espacio de cálculo | T4: comprobar estabilidad | Métricas y comparación de ejecuciones | Un grupo inestable debe interpretarse con cautela |
| Validación: cobertura | Media de banderas `has_*` | T1/T4: resumir confiabilidad | Barras horizontales con porcentaje | Compara fuerza de evidencia entre fuentes |
| Validación: nocturnidad | `telem_total_sessions`, `telem_nocturnal_sessions` y cluster | T4: comprobar la explicación de C2 | Dispersión con `log(1+x)`, color y selección | C2 combina intensidad total y actividad nocturna registrada |
| Validación: bienestar/riesgo | PROMIS, WEMWBS, GDT, BANGS y uso del tiempo | T4: comparar C3 con otros perfiles | Barras agrupadas estandarizadas | Describe diferencias simultáneas; no diagnostica ni establece causa |
| Validación: multiplataforma | Cobertura de fuentes dentro de cada grupo | T4: comprobar la explicación de C0 | Barras agrupadas por fuente y cluster | Distingue comportamiento de cantidad de datos disponibles |

## Qué estaba débil y ya se corrigió

Antes, T2 y T3 incluían métodos como “seleccionar el vector”, “proyectar” y
“agrupar” dentro del objetivo. Esos verbos explicaban principalmente el mecanismo.
Ahora las tareas expresan la meta de conocimiento y el informe incluye la
clasificación completa de Munzner: acción de análisis, búsqueda, consulta y objetivo.

La pestaña Validación también muestra una línea **Abstracción Why** en cada caso.
Esto permite explicar primero qué se intenta conocer y después qué variables,
transformación y gráfico se utilizaron.

## Respuesta oral breve

> Definimos las tareas con el marco Why de Munzner. Primero descubrimos qué fuentes
> tienen evidencia suficiente; después comparamos variables y derivamos el vector;
> luego exploramos similitudes para localizar perfiles; finalmente comprobamos cada
> perfil con variables originales y cobertura. Los filtros, PCA, K-means, el lazo y
> los gráficos son el cómo de la herramienta, no las tareas en sí.
