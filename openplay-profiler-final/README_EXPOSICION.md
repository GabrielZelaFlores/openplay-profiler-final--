# Guion de exposición de OpenPlay Profiler — 8 minutos

Este archivo contiene únicamente el recorrido de la exposición: qué preparar, qué
decir, qué abrir en el dashboard y qué señalar. El objetivo no es mostrar todas las
funciones, sino demostrar que la herramienta permite obtener y comprobar
conocimiento.

---

## 1. Preparación antes de que empiecen los 8 minutos

Realiza estos pasos entre 10 y 15 minutos antes de exponer.

1. Abre una terminal dentro de `openplay-profiler-final`.
2. Ejecuta:

   ```bash
   npm run dev
   ```

3. Abre `http://localhost:3000`.
4. En **Datos**, pulsa **Cargar openplay_consolidated.csv (precompilado)**.
5. Comprueba que aparezcan aproximadamente:

   - 2544 participantes;
   - 171 variables;
   - el resumen de cobertura por fuente.

6. En **Filtros**, asegúrate de que diga `Mostrando 2544 de 2544 participantes`.
   Si hay filtros, pulsa **Limpiar**. Si aparece una selección global, pulsa
   **Quitar selección**.
7. En **Vector**, pulsa **Seleccionar vector integral recomendado**. Deben quedar
   seleccionadas 19 variables.
8. Regresa a **Datos**. Desde esta pestaña comienza la exposición.
9. Ajusta el zoom del navegador entre 80 % y 90 % para que se vean los gráficos y
   controles sin desplazarte demasiado.
10. Cierra descargas, mensajes y programas que puedan aparecer sobre la pantalla.

No comiences cargando archivos durante el tiempo evaluado. El dataset debe estar
cargado y el vector preparado antes de iniciar.

---

## 2. Orden de pestañas durante la exposición

Usa solamente este recorrido:

```text
Datos → Vector → PCA / t-SNE / UMAP → Bivariado → Encuestas → Datos → Validación
```

La idea de este recorrido es mostrar primero cómo se generan los perfiles y después
cómo se obtienen las evidencias en vistas normales. **Validación se abre al final**:
no crea los clusters, sino que resume y contrasta la ejecución ya realizada.

---

## 3. Guion cronometrado

### 0:00–0:40 — Problema y objetivo

**Dashboard:** permanece en **Datos**. Coloca el cursor sobre el título y el resumen
general, sin hacer clic todavía.

**Di exactamente o con tus propias palabras:**

> Buenos días. Nuestro proyecto se llama OpenPlay Profiler. El problema es que
> OpenPlay reúne información de distintas fuentes: telemetría de videojuegos,
> encuestas, cognición y uso del tiempo. Analizar columnas por separado no permite
> reconocer fácilmente qué combinaciones distinguen a los participantes. Por eso
> nuestro objetivo es identificar perfiles exploratorios de jugadores y explicar
> qué variables los diferencian. Los perfiles son descriptivos: no son diagnósticos
> ni demuestran causalidad.

**Qué debe entender la profesora:** existe un problema concreto, un objetivo
concordante y un límite responsable de interpretación.

---

### 0:40–1:25 — Dataset y calidad de la evidencia

**Dashboard:** en **Datos**, señala los indicadores de participantes y variables.
Después señala las barras de **Cobertura por fuente**.

**Di:**

> La copia pública analizada contiene 2544 participantes y 171 variables. Antes de
> buscar perfiles revisamos la cobertura, porque una diferencia puede representar
> comportamiento, pero también puede aparecer porque algunos participantes tienen
> más datos. Steam alcanza aproximadamente 80.1 % de cobertura, mientras Xbox tiene
> 10.9 %, iOS 3.7 % y Android 2.9 %. Por eso una conclusión basada en Steam tiene más
> respaldo que una basada únicamente en Android o iOS.

**Señala:** una barra alta y una barra baja.

**No digas:** “Steam es la plataforma más utilizada”. El gráfico mide cobertura de
datos, no preferencia ni intensidad de juego.

**Tarea de Munzner:** T1, descubrir y resumir qué fuentes tienen evidencia
suficiente.

---

### 1:25–2:05 — Vector de características

**Dashboard:** abre **Vector**. Señala:

1. `19 variables`;
2. los nombres de algunas variables seleccionadas;
3. el panel **Evaluación del vector**;
4. la matriz de correlaciones, sin intentar explicarla celda por celda.

**Di:**

> Después construimos una representación común de cada participante. El vector
> recomendado contiene 19 variables de plataformas, telemetría, bienestar, riesgo,
> cognición y uso del tiempo. Solo las variables numéricas entran a los cálculos.
> Como tienen escalas distintas, se estandarizan; y los valores faltantes se tratan
> mediante imputación. La cobertura y las correlaciones se revisan para evitar que
> una familia de variables domine o repita demasiada información.

**Explicación sencilla si señalas la correlación:**

> La correlación indica si dos variables tienden a cambiar juntas. No demuestra que
> una cause a la otra.

**Tarea de Munzner:** T2, comparar atributos y derivar un vector defendible.

---

### 2:05–3:05 — Proyección y formación de grupos candidatos

**Dashboard:** abre **PCA / t-SNE / UMAP**.

1. Selecciona **PCA**.
2. Mantén **Mediana de columna (oficial)** como imputación.
3. Pulsa **Ejecutar PCA**.
4. Mientras calcula, continúa hablando.
5. Cuando aparezca la nube de puntos, señala la proyección y la varianza explicada.
6. En **Perfiles oficiales y comparación en 2D**, deja:

   - algoritmo: **K-means (perfiles)**;
   - número de clusters: **4**.

7. Pulsa **Agrupar y colorear**.
8. Señala la nube coloreada, las métricas y la tabla de perfiles, sin leer todas las
   cifras.

**Di mientras ejecutas PCA:**

> PCA resume las 19 variables en dos ejes para representar a cada participante como
> un punto. Los puntos cercanos tienen combinaciones aproximadamente parecidas en el
> vector. Esta vista sirve para explorar similitudes y localizar grupos candidatos;
> la forma de la nube no basta para concluir.

**Di al ejecutar K-means:**

> Utilizamos K-means con cuatro grupos como una configuración exploratoria y
> reproducible. El color solo distingue los grupos calculados. Para interpretarlos
> regresamos a las variables originales y comprobamos cada explicación en otra
> vista.

**Importante:** los colores C0–C3 de esta pantalla son exactamente las etiquetas de
la ejecución oficial sobre el vector original. PCA solo muestra dónde quedan esos
perfiles; no vuelve a agrupar la proyección.

**Tarea de Munzner:** T3, explorar similitudes para localizar perfiles y posibles
casos atípicos. PCA y K-means son el método, no la tarea.

---

### 3:05–4:35 — Caso principal 1: intensidad total y nocturna

**Dashboard:** abre **Bivariado** y pulsa **Generar Caso 2: intensidad nocturna**.
Comprueba que aparezcan:

1. eje X: `telem_total_sessions`;
2. eje Y: `telem_nocturnal_sessions`;
3. color: **perfil oficial** o `official_cluster`;
4. escala: `log(1+x)`.

El gráfico usa las etiquetas que acabas de generar con K-means. Señala la zona
correspondiente a C2. Puedes pasar el cursor sobre un punto, pero no abras muchos
participantes.

**Di:**

> El primer hallazgo responde a esta pregunta: ¿la actividad nocturna aparece
> aislada o forma parte de una mayor intensidad general? El gráfico usa sesiones
> totales, sesiones nocturnas y el perfil calculado. Aplicamos logaritmo de uno más
> el valor para reducir visualmente el efecto de los extremos, sin cambiar el orden
> de los participantes. C2 contiene 473 participantes y presenta los mayores valores registrados
> muy superiores tanto en actividad total como nocturna. Por eso lo interpretamos
> como un perfil de alta intensidad registrada que también ocurre de noche.

**Continúa:**

> Este resultado se detecta mediante el agrupamiento, se explica con las variables
> originales y se confirma en la dispersión. No afirmamos que jugar de noche cause
> problemas de sueño, ansiedad o menor bienestar, porque este análisis no demuestra
> causalidad.

**Tarea de Munzner:** T4, localizar un perfil conocido, compararlo y comprobar su
explicación.

---

### 4:35–5:55 — Caso principal 2: bienestar, riesgo y uso registrado

**Dashboard:** abre **Encuestas**. En la parte superior aparecerá
**Caso 3 generado: bienestar, riesgo y uso registrado**. Señala la tarjeta de la
ejecución activa y después las barras agrupadas. Este gráfico se obtiene aquí desde
los perfiles ya calculados; no depende de abrir Validación.

**Di:**

> El segundo hallazgo pregunta si bienestar, riesgo y uso del tiempo se diferencian
> simultáneamente dentro de un perfil. Aquí comparamos PROMIS, WEMWBS, GDT, BANGS y
> registros de uso del tiempo. Las barras muestran cuánto se aleja la media de cada
> grupo de la media general, después de estandarizar las variables.

> C3 contiene 385 participantes. Presenta mayor PROMIS, mayor GDT y BANGS, menor
> WEMWBS y más registros de uso del tiempo relacionados con videojuegos. El
> conocimiento no proviene de una sola barra: es la combinación simultánea de esas
> dimensiones la que caracteriza al perfil.

**Añade el límite:**

> Este grupo tampoco es un diagnóstico. Además, tener más registros de uso puede
> significar que el participante fue observado durante más tiempo. Por eso la
> interpretación debe controlarse con cobertura y disponibilidad de fuentes.

**No digas:** “C3 está deprimido”, “C3 es adicto” o “los videojuegos causaron bajo
bienestar”. Di “presenta valores mayores o menores en las escalas registradas”.

---

### 5:55–6:45 — Control de observabilidad: perfil multiplataforma

**Dashboard:** regresa a **Datos**. Señala **Caso 4 generado: cobertura por perfil**
y las barras de cobertura por cluster. La cobertura general se obtiene antes del
clustering; esta segunda comparación se genera después usando las etiquetas C0–C3.

**Di:**

> Este control evita confundir comportamiento con cantidad de datos. C0 contiene
> 569 participantes y presenta, en promedio, más plataformas declaradas y más
> plataformas con telemetría. Por eso parte de su separación se explica por mayor
> observabilidad multiplataforma, no necesariamente porque juegue más. Este caso
> demuestra por qué la cobertura debe revisarse antes y después del clustering.

No leas todas las plataformas. Señala únicamente que la cobertura cambia entre
grupos.

---

### 6:45–7:25 — Tareas, vistas y validación

**Dashboard:** abre **Validación** por primera vez. Señala que reconoce la ejecución
oficial compartida y luego las tarjetas de procedencia y el bloque de patrón,
validación, conocimiento y límite. Aclara que esta pestaña no volvió a ejecutar
K-means: está comprobando los resultados generados en las vistas anteriores.

**Di:**

> Las tareas se definieron con el marco de Munzner. Primero descubrimos qué evidencia
> puede utilizarse; después comparamos variables y construimos el vector; luego
> exploramos similitudes para localizar perfiles; finalmente comprobamos cada perfil
> con variables originales y cobertura. Filtrar, ejecutar PCA, aplicar K-means o
> seleccionar puntos son interacciones y métodos: no son las tareas por sí mismos.

> La herramienta integra estas etapas porque la salida de una vista se utiliza como
> entrada de la siguiente. Cada conclusión tiene una vista de descubrimiento y otra
> de confirmación.

---

### 7:25–8:00 — Conclusión

**Dashboard:** deja visible el caso de Validación. No cambies de pestaña durante el
cierre.

**Di:**

> En conclusión, encontramos tres explicaciones principales: C2 combina alta
> actividad total y nocturna registrada; C3 combina diferencias en bienestar,
> riesgo y uso registrado; y C0 muestra que algunos grupos también se separan por
> observabilidad multiplataforma. El aporte de OpenPlay Profiler no es generar una
> nube de puntos, sino permitir pasar de una separación visual a una explicación con
> variables originales, cobertura y límites explícitos. Gracias.

Detente aquí. No agregues nuevas conclusiones después del cierre.

---

## 4. Resumen operativo de clics

| Tiempo | Pestaña | Acción |
|---|---|---|
| Antes | Datos | Cargar CSV precompilado |
| Antes | Filtros | Limpiar filtros y selección global |
| Antes | Vector | Seleccionar vector integral recomendado |
| 0:00 | Datos | Señalar participantes, variables y cobertura |
| 1:25 | Vector | Señalar 19 variables, evaluación y correlaciones |
| 2:05 | PCA / t-SNE / UMAP | PCA → Ejecutar PCA → K-means, 4 → Agrupar y colorear |
| 3:05 | Bivariado | Sesiones totales vs. nocturnas → color por perfil oficial |
| 4:35 | Encuestas | Señalar comparación de bienestar/riesgo por perfil |
| 5:55 | Datos | Señalar cobertura por perfil |
| 6:45 | Validación | Confirmar ejecución previa y señalar procedencia y límites |

---

## 5. Si la aplicación tarda o algo falla

### Si PCA demora

No permanezcas en silencio. Continúa con la explicación de PCA. Si después de 15
segundos todavía no termina, di:

> El cálculo se ejecuta en un Web Worker para no bloquear la interfaz. Para respetar
> el tiempo continuaré explicando las variables y el recorrido de comprobación.

No abras **Validación** sin haber generado K-means: ahora esa pestaña muestra
correctamente que falta la ejecución oficial.

### Si no aparece el botón de agrupamiento

Debes esperar a que PCA termine. Si no termina, usa como respaldo las figuras del
PDF y explica el recorrido; Validación no generará perfiles por su cuenta. No
reinicies la página durante la exposición.

### Si un gráfico aparece vacío

1. Revisa que no exista un filtro activo.
2. Comprueba que **Vector recomendado** esté activo.
3. No cambies variables ni parámetros durante la exposición.
4. Usa como respaldo el PDF `output/pdf/informe-openplay-profiler.pdf`.

### Si los colores o etiquetas cambian

El significado no depende del color. Identifica el grupo por sus variables y su
tamaño. No digas “el grupo azul”; di “el perfil con mayor actividad nocturna” o “el
perfil con mayor cobertura multiplataforma”.

---

## 6. Preguntas probables después de la exposición

### ¿Cuál es la diferencia entre tarea y funcionalidad?

> La tarea expresa el conocimiento buscado, por ejemplo comprobar si un perfil se
> mantiene al controlar cobertura. Filtrar es una funcionalidad que permite realizar
> esa tarea.

### ¿Por qué utilizaron cuatro clusters?

> Es una configuración exploratoria reproducible que produjo grupos con tamaño y
> variables interpretables. No afirmamos que cuatro sea la única división correcta;
> la herramienta permite revisar métricas y estabilidad.

### ¿Por qué PCA si también tienen UMAP y t-SNE?

> PCA se utilizó como referencia principal porque es reproducible y permite reportar
> varianza explicada. UMAP y t-SNE sirven para contrastar vecindades, pero una forma
> visual siempre debe comprobarse con variables originales.

### ¿Qué significa estandarizar?

> Convertir variables de escalas distintas a una escala comparable, para evitar que
> una variable domine solo por tener números más grandes.

### ¿Qué significa imputar?

> Completar un valor faltante con una regla definida, como la media o la mediana. No
> recupera el valor real; permite ejecutar el cálculo y se reconoce como limitación.

### ¿Qué conocimiento nuevo obtuvieron?

> Que la nocturnidad observada forma parte de un perfil de intensidad general; que
> un perfil combina diferencias simultáneas de bienestar, riesgo y uso registrado;
> y que otra separación se explica en parte por mayor observabilidad
> multiplataforma.

### ¿El juego nocturno causa menor bienestar?

> No. Encontramos asociaciones descriptivas entre variables y perfiles. El diseño no
> permite afirmar causalidad.

### ¿Cómo usaron inteligencia artificial?

> Se utilizó como apoyo para revisar redacción, código y pruebas. Los resultados no
> fueron inventados por la IA: se calculan desde el dataset y se comprobaron con
> variables originales, pruebas automáticas y más de una vista.

---

## 7. Frases que debes evitar

| Evita decir | Di en su lugar |
|---|---|
| “PCA encontró la verdad” | “PCA permitió explorar similitudes en una representación 2D” |
| “El cluster azul es…” | “El perfil caracterizado por estas variables es…” |
| “C3 está deprimido” | “C3 presenta mayor PROMIS y menor WEMWBS registrado” |
| “Los videojuegos causan…” | “Las variables muestran una asociación descriptiva” |
| “Android casi no se usa” | “Android tiene baja cobertura en este dataset” |
| “Nuestra tarea fue ejecutar K-means” | “La tarea fue localizar perfiles; K-means fue el método” |
| “Imputamos y solucionamos los faltantes” | “Imputamos para ejecutar el cálculo y reconocemos la incertidumbre” |

---

## 8. División sugerida si exponen dos personas

### Persona 1 — 0:00 a 3:05

- problema y objetivo;
- dataset y cobertura;
- vector;
- PCA y formación de grupos candidatos.

Entrega la palabra diciendo:

> Ahora mostraremos cómo esos grupos candidatos regresan a las variables originales
> y se validan mediante casos concretos.

### Persona 2 — 3:05 a 8:00

- Caso 2;
- Caso 3;
- Caso 4 como control de cobertura;
- tareas de Munzner;
- conclusión.

Ambas personas deben saber explicar qué son estandarización, imputación, PCA,
K-means, cobertura, correlación y la diferencia entre asociación y causalidad.
