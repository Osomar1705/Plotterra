# FieldShift v6 — Farmer-first UI (English)

## Qué cambió

1. **Options**: tarjetas claras centradas en la rotación, margen estimado, indicador hídrico y riesgo. Se retiran «Try a change», su repetición del chatbot, «Why this one?» y las etiquetas técnicas de la cabecera. El asistente flotante sigue permitiendo simular cambios con confirmación. Los resultados de 100 casos pasan a «See test details».
2. **Plan**: cuatro secciones, en orden: «Your selected plan» → «Your planting schedule» → «Why this plan?» → «Numbers and sources».
3. **Calendario**: la vista principal muestra tres pasos con nombre completo y ventana para *iniciar la siembra*. «View full calendar» resalta los meses **solo de la ventana de siembra**, sin confundirlos con meses de crecimiento, cosechas o predicciones futuras de lluvia. Los meses sin resaltar no implican barbecho.
4. **Resultados**: cuatro grupos con íconos y botones «info» en los que se explica qué significa cada métrica. Un desplegable recoge las demás métricas del endpoint del pasaporte, otro los casos simulados y otros las fuentes y limitaciones. Los valores visibles provienen de la comparación y del pasaporte; no se inventan datos por cultivo.
5. **Plan habitual**: desaparece de la interfaz de simulaciones; en el demo se había preparado una secuencia de ejemplo, no confirmada por el agricultor.
6. **Chatbot**: se conserva IA-first, historial y simulación. El texto visible se adapta al inglés y el motor acepta los nombres ingleses «barley» y «potato» manteniendo identificadores internos españoles `cebada`, `papa`.
7. **Vista Plot**: se tradujeron sus instrucciones principales al inglés y se retiró el formulario de plan habitual.
8. **Sin fotos reales como fondo del simulador**: animación sobre un fondo claro.

## Criterios de integridad de datos

- «Water exposure» (`exposicion_hidrica`) **no** se presenta como cantidad exacta de riego requerido.
- Las 100 pruebas **no** se presentan como probabilidad validada de éxito.
- El modo mock muestra una nota explícita de «Demo data». Las fuentes NASA/MIDAGRI no se atribuyen a una corrida de ejemplo.
- El frontend no inventa datos de rendimiento por campaña, cosecha, lluvia futura ni costos de producción si el backend no los devuelve.
- El pasaporte (`GET /comparaciones/:id/alternativas/:id/...`, conforme a `getAlternativePassport`) sigue siendo opcional. Si falla, se conservan las métricas de la comparación.
- Etiquetas de fuentes que provengan literalmente del backend pueden mantener el idioma original para no reinterpretar sus afirmaciones.

## Cómo ejecutarlo en Windows

```powershell
cd "$env:USERPROFILE\Downloads\FieldShift_frontend_v6_FARMER_FIRST_EN"
npm install
npm run dev:frontend
```

Abre `http://localhost:5173/`. Para activar el chatbot real, coloca una clave privada en `.env.ai` (copiando de `.env.ai.example`) y ejecuta `npm run dev` en lugar de `npm run dev:frontend`. **Nunca subas `.env.ai` a GitHub.**

## Verificación

- `node --test tests/*.test.mjs`: 14/14 pruebas OK (incluidas propuestas de cambios en inglés).
- `tsc -b`: OK usando tipos de React disponibles en el entorno y una declaración temporal de tipos para `motion/react` (esta declaración temporal no va en el ZIP).
- `vite build`: pendiente de validar en Windows; este contenedor no incluye el binding Linux de Rolldown ni el paquete Motion descargado para ejecutar el bundle completo.
