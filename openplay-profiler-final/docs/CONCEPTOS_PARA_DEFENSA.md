# Conceptos que deben comprender para defender el proyecto

No memoricen definiciones largas. Deben poder explicar estas ideas con sus propias
palabras y señalarlas en la aplicación.

## 1. ¿De dónde salen los gráficos de Validación?

No son imágenes pegadas. Se calculan desde `openplay_consolidated.csv`.

La aplicación crea una sola ejecución oficial con 19 variables, imputación por
mediana, estandarización y K-means sobre el vector original. Esa ejecución guarda
la etiqueta de cada participante. PCA, Bivariado y Validación reutilizan las mismas
etiquetas; no vuelven a formar clusters diferentes.

- Cobertura: se toma cada columna `has_*`, se calcula qué porcentaje vale 1 y se
  dibuja una barra por fuente.
- Juego nocturno: cada punto es un participante. El eje X usa sesiones totales, el
  eje Y sesiones nocturnas y el color indica su grupo.
- Bienestar y riesgo: se calcula el promedio de cada variable dentro del grupo y se
  compara con el promedio general.
- Multiplataforma: se calcula qué porcentaje de cada grupo tiene datos de Steam,
  Xbox, Nintendo y las demás fuentes.

Los casos tampoco son elegidos automáticamente por una imagen. Después de formar
los grupos se calculan las diferencias estandarizadas de sus variables. Se registra
un caso cuando la diferencia es relevante para el objetivo, puede explicarse con
variables originales, puede confirmarse en otra vista y tiene límites claros. La
pestaña Validación muestra el criterio cuantitativo y permite abrir las variables en
Bivariado, Profiling o Filtros.

En el gráfico nocturno se usa `log(1 + valor)` porque existen diferencias muy
grandes entre participantes. Esta transformación comprime los valores extremos para
que los demás puntos también puedan verse, pero mantiene su orden: un valor mayor
sigue apareciendo como mayor.

## 2. ¿Qué es el vector?

Es la lista de variables usada para comparar a los participantes. Si cambian las
variables del vector, pueden cambiar el mapa y los grupos. Por eso el vector debe
tener variables relevantes y cobertura suficiente.

## 3. ¿Qué significa estandarizar?

Las variables tienen escalas diferentes. Las sesiones pueden ser miles y GDT tiene
números mucho menores. Estandarizar las coloca en una escala comparable para que
las sesiones no dominen solamente por tener números más grandes.

Respuesta oral: “Convertimos las variables a una escala común antes de comparar a
los participantes”.

## 4. ¿Qué significa imputar?

Es completar un dato faltante usando una regla, como la media o mediana de la
columna. No recupera el valor real; solo permite realizar el cálculo. Por eso se
considera una limitación.

## 5. ¿Qué hace PCA?

PCA resume varias variables en dos ejes para poder dibujar a cada participante como
un punto. Los puntos cercanos tienen valores parecidos en las variables elegidas.
Los ejes no son “bienestar” o “sesiones” directamente; combinan las variables.

## 6. ¿Qué hace K-means?

Forma la cantidad de grupos indicada. Primero coloca centros, asigna cada punto al
centro más cercano y vuelve a calcularlos hasta que los grupos dejan de cambiar.

Usar cuatro grupos no significa que cuatro sea una verdad definitiva. Es una
configuración exploratoria que produjo perfiles que se pueden explicar y comparar.
Como K-means puede intercambiar sus números, el sistema asigna C0--C3 por sus
características: multiplataforma, base, intensidad y bienestar/riesgo/uso.

## 7. ¿Qué significa un valor estandarizado positivo o negativo?

- Positivo: el promedio del grupo está por encima del promedio general.
- Negativo: está por debajo.
- Cerca de cero: es parecido al promedio general.

No significa automáticamente “bueno” o “malo”; depende de la variable.

## 8. ¿Qué es cobertura?

Es el porcentaje de participantes con datos de una fuente. Steam tiene 80.1 %,
mientras Android tiene 2.9 %. Un resultado basado en Android representa muchos
menos participantes y debe explicarse con cautela.

## 9. ¿Qué significa correlación?

Indica que dos variables tienden a cambiar juntas. No demuestra que una provoque a
la otra. En el caso nocturno, sesiones totales y nocturnas aumentan juntas, pero eso
no demuestra consecuencias sobre la salud.

## 10. ¿Qué conocimiento encontraron?

- C2 no solo juega en horario nocturno: combina actividad total y nocturna muy alta.
- C3 reúne mayor PROMIS y riesgo, menor WEMWBS y más uso del tiempo registrado.
- C0 tiene datos de más plataformas; parte de su separación puede deberse a que fue
  observado por más fuentes, no necesariamente a que juega más.

## 11. ¿Por qué estos resultados no son diagnósticos?

Porque son grupos descriptivos formados por similitud. El proyecto no incluye una
evaluación clínica ni un diseño que permita demostrar causas.

## 12. Uso de inteligencia artificial

Respuesta honesta recomendada:

“Usamos inteligencia artificial como apoyo para revisar redacción, código y pruebas.
No aceptamos resultados automáticamente. Comprobamos que las variables existieran,
que las cifras salieran de los archivos generados y que cada patrón apareciera en
más de una vista. La interpretación y la explicación final son nuestras”.

Nunca respondan que un patrón es correcto “porque lo dijo la IA”. Señalen las
variables, el gráfico de descubrimiento y la vista que lo confirma.

## Preguntas que cada integrante debe responder sin leer

1. ¿Qué columnas generan cada gráfico de Validación?
2. ¿Por qué se usa logaritmo en el gráfico nocturno?
3. ¿Por qué se estandarizan las variables?
4. ¿Qué diferencia existe entre seleccionar un punto y realizar una tarea analítica?
5. ¿Qué vista detecta cada patrón y qué vista lo confirma?
6. ¿Qué limitación tiene cada caso?
7. ¿Por qué no se puede afirmar causalidad?
