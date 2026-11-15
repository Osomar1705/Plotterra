# v9 — fotos reales + acople al backend actual

- Cabeceras de **Entrada** y **Opciones**: foto real de andenes (Wikimedia Commons, `Photo.tsx`) en lugar del paisaje animado. Si la foto no carga se ve el dibujo de respaldo.
- ANTES DE PUBLICAR: revisar la licencia de la foto en el enlace del crédito.
- API: por defecto usa el backend real (`VITE_USE_LOCAL_MOCKS=false`); error `SIN_CONEXION` y respuestas no-JSON manejadas.
- Plan: métricas por campaña formateadas (rendimiento, déficit, margen en USD); suelo "bueno/regular/pobre" traducido; fechas de siembra legibles en las tarjetas.
- Probado contra el backend del repo (`FIELDSHIFT_MOTOR=real`, requiere `pyarrow`).
- Deploy: `vercel.json` y `render.yaml` de main incluidos.

## v11 · simulación explicada con escenas + foto que cambia de ambiente

Reemplaza la transición v10 (se descartó el estilo oscuro y los titulares gigantes). Mantiene el estilo claro de la app.

- `components/futures/SimulationReveal.tsx` (reescrito): tarjeta clara con 5 pasos (Typical years · Less rain · Less water · Lower prices · All at once).
  Cada tipo de futuro dura ~1.5 s (0.4 s si el cambio viene del chat) y las 100 celdas aparecen mientras se prueba.
- `components/futures/StressScene.tsx` (nuevo): la foto real de la chacra cambia de ambiente (lluvia que baja, tierra que se seca con grietas,
  gráfico de precio que cae) y 3 medidores (Rain / Irrigation water / Crop price) muestran los factores REALES de la prueba en curso
  (`rainFactor`, `irrigationFactor`, `priceFactor` del backend; si no vienen, el valor típico del tipo).
- `components/futures/Particles.tsx` (nuevo): partículas en canvas (lluvia, monedas, puntitos de suelo). Sin dependencias.
- `components/futures/HeroAmbience.tsx` (nuevo) + `ComparisonPage`/`AlternativeCard`: al pasar el cursor (o enfocar con teclado) por una opción,
  la foto de la cabecera cambia de ambiente y la frase de abajo del título explica la opción.
- `FuturesGrid`: prop opcional `shown(i)` para que las celdas aparezcan guiadas por la simulación.
- Se quitó Barlow Condensed del `@import` (ya no se usa). Se mantienen el botón destacado del chatbot y la onda de voz de v10.

### v11b · escenas ilustradas (reemplazan la foto real en la simulación)
- `src/assets/scenes/{rain,drought,good,dead}.webp` (ilustraciones propias del equipo, ~50-110 KB c/u).
- `StressScene.tsx`: mezcla las ilustraciones según el tipo de futuro y los factores reales de cada prueba:
  Typical years → lluvia · Less rain → lluvia→sequía · Less water → buen suelo→sequía · Lower prices → buen suelo + gráfico · All at once → suelo muerto · resultado → buen suelo.
- Encima: lluvia animada en canvas, brillos del suelo, zoom lento y medidores con valores reales.
