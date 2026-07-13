# Privacidad y publicación de datos

La aplicación pública utiliza una copia minimizada del dataset OpenPlay. No debe
publicarse ningún archivo fuente ni una exportación que contenga identificadores
originales de participantes.

## Transformaciones obligatorias

`npm run data:sanitize` aplica de forma determinista las siguientes medidas:

- elimina `pid`, ubicación aproximada, medidas corporales y demografía detallada;
- elimina respuestas de neurodiversidad que aumentan el riesgo de reidentificación;
- reemplaza `record_id` por un consecutivo sin relación con el identificador original;
- redondea la edad a intervalos de cinco años;
- agrupa categorías de género o país con menos de diez participantes como `Other`.

Estas medidas reducen el riesgo, pero no convierten automáticamente los datos en
anónimos bajo todas las legislaciones. Antes de desplegar una nueva versión se debe
confirmar la base legal, el consentimiento, las condiciones del proveedor de los
datos y realizar una evaluación formal de riesgo de reidentificación.

## Procedimiento de publicación

1. Mantener las fuentes exclusivamente en `data/`, que está ignorado por Git.
2. Regenerar el consolidado local con `npm run build:data`.
3. Ejecutar `npm run data:sanitize` antes de copiar o desplegar `public/data`.
4. Ejecutar `npm test` y comprobar que la prueba de privacidad pasa.
5. Revisar manualmente que no existan `pid`, `geo_area` ni columnas excluidas.

## Licencia

El código del repositorio y los datos OpenPlay son artefactos distintos. Este
repositorio no concede derechos sobre los datos fuente. La redistribución requiere
una licencia o autorización explícita del titular del dataset. Hasta documentar esa
autorización, la copia pública debe considerarse exclusivamente una versión
minimizada para la entrega académica y no debe reutilizarse como dataset abierto.
