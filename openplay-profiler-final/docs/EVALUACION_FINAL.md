# Preparación analítica para la evaluación final

## A. Diagnóstico del proyecto

El proyecto cumple al identificar perfiles exploratorios, conectar profiling,
vector, filtros, proyección, clustering y validación, e interpretar los grupos con
variables originales. Los cuatro casos se calculan con datos reales y el informe
reconoce faltantes, cobertura desigual, imputación y sensibilidad a parámetros.

Debía reforzarse la diferencia entre tarea e interacción, la justificación de las
codificaciones visuales, el recorrido cognitivo oral y la separación explícita
entre pregunta, patrón, explicación y conocimiento.

La copia consolidada no contiene columnas directas llamadas ansiedad, depresión,
toxicidad u horas de sueño. La exposición no debe afirmar que el juego nocturno
causa esos resultados. Las conclusiones válidas se limitan a telemetría, PROMIS,
WEMWBS, GDT, BANGS, cognición, plataformas y uso del tiempo disponibles.

## B. Correcciones necesarias

1. Presentar tareas como preguntas y decisiones analíticas.
2. Explicar cada interacción como parte de una búsqueda, no como funcionalidad.
3. Mostrar una vista de descubrimiento y otra de confirmación.
4. Mencionar cobertura e imputación antes de interpretar clusters.
5. Diferenciar asociación descriptiva de causalidad o diagnóstico.
6. Concentrar la exposición en dos casos y mantener los demás como respaldo.

## C. Texto corregido

### Objetivo analítico

Identificar perfiles exploratorios de jugadores y explicar qué combinaciones de
telemetría, cobertura de plataformas, bienestar, riesgo de juego problemático,
cognición y uso del tiempo diferencian a esos perfiles. La herramienta busca
detectar relaciones, grupos y casos atípicos y validar cada interpretación con más
de una vista y con variables originales, sin formular diagnósticos ni causalidad.

### Diferencia entre conceptos

- **Pregunta:** ¿Existe un perfil con actividad nocturna especialmente alta?
- **Tarea:** localizarlo, identificar qué variables lo separan y contrastarlo.
- **Interacción:** ejecutar clustering, seleccionar el grupo y cambiar los ejes.
- **Patrón:** C2 combina sesiones nocturnas y totales muy superiores.
- **Conocimiento:** la nocturnidad forma parte de un perfil de intensidad general.

## D. Tabla de tareas analíticas

### Abstracción Why de Munzner

Una tarea no es “hacer clic”, “filtrar”, “ejecutar PCA” o “mostrar un gráfico”.
Es el objetivo de conocimiento del usuario. Para defender cada tarea se usan cuatro
preguntas: qué acción realiza, cómo busca, cuántos elementos consulta y qué aspecto
de los datos intenta comprender.

| ID | Acción de análisis | Búsqueda | Consulta | Objetivo de datos |
|---|---|---|---|---|
| T1 | Descubrir | Explorar fuentes cuya calidad aún no se conoce | Resumir todas y comparar algunas | Cobertura, faltantes, distribuciones y extremos |
| T2 | Descubrir y derivar un vector | Explorar relaciones y localizar pares relevantes | Comparar variables | Correlaciones, distribuciones y similitud entre atributos |
| T3 | Descubrir | Explorar participantes sin conocer perfiles previos | Resumir, identificar y comparar | Similitudes, grupos y casos atípicos |
| T4 | Comprobar una explicación | Localizar un perfil ya detectado | Comparar el perfil con los demás | Características, relaciones y efecto de la cobertura |

La cadena es: T1 decide qué evidencia puede usarse; T2 construye la representación;
T3 localiza candidatos a perfil; T4 comprueba o rechaza la interpretación. Las
interacciones son el medio para completar esa cadena, no las tareas.

| Tarea | Pregunta | Variables | Vistas | Interacciones | Patrón buscado | Conocimiento | Relación con el objetivo |
|---|---|---|---|---|---|---|---|
| Evaluar confiabilidad | ¿Qué fuentes sostienen comparaciones? | `has_steam`, `has_biweekly`, `has_cognitive`, `has_timeuse`, `has_nintendo`, `has_xbox`, `has_ios`, `has_android` | Resumen BI, profiling, filtros | Comparar cobertura y restringir por disponibilidad | Cobertura desigual | Una separación puede reflejar observabilidad | Evita interpretar perfiles con evidencia insuficiente |
| Explicar actividad nocturna | ¿La nocturnidad aparece junto con intensidad total? | `telem_nocturnal_sessions`, `telem_total_sessions` | PCA/clustering, perfil, bivariado | Ejecutar K-means, seleccionar C2 y comparar ejes | Valores altos simultáneos | C2 es alta intensidad que también ocurre de noche | Identifica y explica un perfil conductual |
| Relacionar bienestar, riesgo y uso | ¿Existe un perfil diferenciado en las tres dimensiones? | `promis_total`, `wemwbs_total`, `gdt_total`, `bangs_total`, `timeuse_gaming_entries`, `timeuse_num_days` | Perfil, encuestas, validación, filtros | Seleccionar C3, comparar escalas y controlar cobertura | Diferencias simultáneas | C3 combina mayor PROMIS/riesgo, menor WEMWBS y más uso registrado | Relaciona dimensiones sin diagnosticar |
| Distinguir intensidad de observabilidad | ¿Qué explica C0? | `num_platforms`, `num_telemetry_platforms`, banderas de fuente | Vector, clustering, perfil y cobertura | Seleccionar C0 y comparar fuentes | Más plataformas y telemetría | C0 se separa por observabilidad multiplataforma | Explica el grupo y controla sesgo de cobertura |

## E. Justificación analítica de las vistas

### Datos y resumen BI

Las barras comparten una escala porcentual y permiten ordenar fuentes por cobertura.
Hacen evidente la diferencia entre Steam (80.1 %) y Android (2.9 %), iOS (3.7 %) o
Xbox (10.9 %). Se consulta primero porque condiciona la fuerza de las conclusiones.

### Profiling

Histogramas y boxplots muestran forma, dispersión y extremos; la tabla añade
faltantes y valores exactos. Juntos permiten decidir si una variable tiene variación
real, está dominada por ceros o posee cobertura insuficiente.

### Bivariado

Cada punto es un participante, los ejes muestran dos medidas originales y el color
incorpora una tercera dimensión. Para nocturnidad permite saber si ambas medidas
aumentan juntas y si el cluster depende de pocos atípicos.

### Encuestas y mapa de calor

La agrupación evita mezclar el significado de PROMIS, WEMWBS, GDT y BANGS. La
escala divergente del heatmap permite localizar relaciones positivas, negativas y
redundancias antes de construir el vector.

### Vector

Cobertura, casos completos y correlaciones justifican qué variables representan al
participante. Así la proyección no se interpreta como caja negra.

### Filtros

Filtrar no es la tarea. Se usa para comprobar si el patrón persiste en una submuestra
comparable. Si desaparece al controlar cobertura, la interpretación pierde fuerza.

### PCA, UMAP, t-SNE y clustering

La posición resume similitud multivariada; el color separa clusters y la tabla
devuelve la explicación a variables originales. PCA aporta referencia reproducible;
UMAP y t-SNE contrastan vecindades. La forma 2D nunca basta por sí sola.

### Validación

Cierra el recorrido: el patrón detectado se contrasta con cobertura, variables
originales y una vista específica antes de convertirse en conclusión.

## F. Casos de estudio

### Caso 1. Alta intensidad y actividad nocturna

**Pregunta.** ¿La actividad nocturna forma parte de una mayor intensidad general?

**Variables.** `telem_nocturnal_sessions`, `telem_total_sessions` y disponibilidad.

**Vistas.** PCA con K-means, perfil de cluster y dispersión bivariada.

**Recorrido.** Ejecutar PCA y K-means, localizar C2, revisar las variables dominantes
y abrir bivariado con sesiones totales y nocturnas. Comprobar si C2 forma una
concentración coherente o depende de pocos puntos.

**Patrón.** C2 contiene 473 participantes y registra medias de 3056.74 sesiones
nocturnas y 6209.46 sesiones totales, las mayores de la ejecución oficial.

**Explicación.** Ambas medidas crecen juntas; la separación no representa solo un
horario distinto, sino actividad registrada excepcionalmente alta que también ocurre
de noche. Los ceros y extremos exigen cautela.

**Conocimiento y validación.** La nocturnidad identifica un subgrupo de alta
intensidad registrada. Perfil y dispersión confirman la lectura. No se infiere daño
psicológico ni causalidad.

### Caso 2. Bienestar, riesgo y uso registrado

**Pregunta.** ¿Existe un perfil diferenciado simultáneamente en esas dimensiones?

**Variables.** `promis_total`, `wemwbs_total`, `gdt_total`, `bangs_total`,
`timeuse_gaming_entries`, `timeuse_num_days`.

**Vistas.** Perfil de clusters, encuestas, barras de contraste y filtros.

**Recorrido.** Seleccionar C3, comparar las escalas, revisar uso del tiempo y filtrar
por disponibilidad biweekly y timeuse.

**Patrón.** C3 tiene 385 participantes. Sus medias son PROMIS 21.84, WEMWBS 21.17,
GDT 6.80, 39.40 entradas gaming y 19.02 días de uso del tiempo. La combinación
produce el mayor puntaje del criterio de bienestar, riesgo y uso registrado.

**Explicación.** No es una puntuación aislada: coinciden mayor PROMIS/riesgo, menor
WEMWBS y más registros. La mayor observabilidad puede influir, por lo que no se
concluye que jugar más cause menor bienestar.

**Conocimiento y validación.** Se identifica un perfil multivariado psicológico y
conductual. Escalas, perfil y filtros reproducen la dirección del patrón.

### Caso 3. Observabilidad multiplataforma

**Pregunta.** ¿C0 representa intensidad o mayor cobertura de datos?

**Variables.** `num_platforms`, `num_telemetry_platforms`, `has_steam`,
`has_nintendo`, `has_xbox`.

**Vistas.** Vector, PCA/clustering, perfil y cobertura por cluster.

**Recorrido.** Seleccionar C0, revisar las variables diferenciadoras y comparar las
barras de cobertura entre clusters.

**Patrón.** C0 tiene 569 participantes, 3.42 plataformas declaradas y 2.03 con
telemetría; supera a C1 (1.83/0.90), C2 (1.96/1.21) y C3 (1.89/1.23).

**Explicación.** Más fuentes observan al participante, lo que puede producir más
actividad registrada sin implicar conducta real más intensa.

**Conocimiento y validación.** Se distingue observabilidad de comportamiento. El
perfil estandarizado y la cobertura por fuente confirman la explicación.

## G. Validación

En cada caso una vista detecta la diferencia, una interacción delimita el grupo,
las variables originales proponen una explicación y otra vista la comprueba. Sin la
herramienta habría que unir fuentes y comparar manualmente cientos de columnas. La
validación es descriptiva y depende de faltantes, imputación, vector y parámetros;
no es evidencia causal ni clínica.

## H. Guion de ocho minutos

- **0:00–0:35:** objetivo analítico; no interpretar una nube de puntos sola.
- **0:35–1:15:** cobertura: Steam 80.1 %, Android 2.9 %, iOS 3.7 %, Xbox 10.9 %.
- **1:15–1:50:** pregunta: ¿la nocturnidad está aislada o acompaña la intensidad?
- **1:50–3:10:** PCA + K-means; localizar C2 y variables que lo explican.
- **3:10–4:30:** bivariado; confirmar valores altos en ambos ejes.
- **4:30–5:50:** C3; contrastar PROMIS, WEMWBS, GDT/BANGS y uso del tiempo.
- **5:50–6:45:** controlar cobertura y explicar límites; no causalidad.
- **6:45–7:30:** resumir conocimiento: C2, C3 y observabilidad C0.
- **7:30–8:00:** validar: cada resultado se detecta en una vista y se confirma en otra.

Frase de cierre: “El aporte no es generar gráficos, sino pasar de una separación
visual a una explicación con variables originales y límites explícitos”.

## I. Preguntas y respuestas

**¿Qué conocimiento proporciona?**  
Qué combinación de comportamiento, bienestar, riesgo y cobertura explica perfiles
que no eran visibles en columnas separadas.

**¿Por qué C2 es un patrón?**  
Porque varias variables cambian conjuntamente en 473 participantes y la misma
diferencia aparece en el perfil y la dispersión.

**¿Cómo validaron?**  
Con proyección, variables originales, vista bivariada, escalas, cobertura y filtros.

**¿Qué aporta bivariado frente a PCA?**  
PCA localiza el grupo multivariado; bivariado muestra la relación original que
explica su separación.

**¿Por qué barras para cobertura?**  
Comparan porcentajes sobre una escala común y revelan fuentes débiles rápidamente.

**¿Tarea versus funcionalidad?**  
Filtrar es funcionalidad; comprobar si el patrón persiste controlando cobertura es
la tarea analítica.

**¿Qué no era evidente sin la herramienta?**  
Que C0 puede separarse por observabilidad y que C3 reúne diferencias psicológicas y
de uso simultáneas.

**¿Jugar de noche reduce bienestar?**  
No puede afirmarse. El análisis es descriptivo, no causal.

**¿Por qué cuatro clusters?**  
Es una configuración exploratoria reproducible con perfiles interpretables. La
herramienta permite evaluar métricas y estabilidad; no se presenta como única opción.
