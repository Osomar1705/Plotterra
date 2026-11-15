# v9 — fotos reales + acople al backend actual

- Cabeceras de **Entrada** y **Opciones**: foto real de andenes (Wikimedia Commons, `Photo.tsx`) en lugar del paisaje animado. Si la foto no carga se ve el dibujo de respaldo.
- ANTES DE PUBLICAR: revisar la licencia de la foto en el enlace del crédito.
- API: por defecto usa el backend real (`VITE_USE_LOCAL_MOCKS=false`); error `SIN_CONEXION` y respuestas no-JSON manejadas.
- Plan: métricas por campaña formateadas (rendimiento, déficit, margen en USD); suelo "bueno/regular/pobre" traducido; fechas de siembra legibles en las tarjetas.
- Probado contra el backend del repo (`FIELDSHIFT_MOTOR=real`, requiere `pyarrow`).
- Deploy: `vercel.json` y `render.yaml` de main incluidos.
