# FieldShift v7 — calendario respaldado por el backend y escenarios en Plan

## Qué se implementó

- Vista Plan de una sola alternativa: ya no permite cambiar entre planes en esta pantalla.
- `src/api/normalizers.ts` traduce `siembra` → `sowingDate`, `cosecha` → `harvestDate` y `ventana_dias` → `durationDays`. **En la API real `campanas[].ventana` es el intervalo entre siembra y cosecha, no una ventana de siembra.** La v6 interpretaba mal ese dato.
- Tres tarjetas de campaña: cultivo, fecha de siembra sugerida, fecha estimada de cosecha y duración. Muestran intervalos entre campañas sin tratarlos como barbecho obligatorio.
- `src/components/ScenarioBreakdown.tsx`: distribuye los 100 resultados en categorías reales identificadas por el backend (sin adivinar categorías si faltan metadatos); al pulsar ⓘ se explica la categoría y al tocar un cuadro se muestra el margen del caso.
- `src/components/PlanWhyAI.tsx`: solicita una explicación de GPT-4o mini basada en el contexto y el plan seleccionado. Usa el backend privado existente y almacena una copia temporal durante una hora. Si la IA no está conectada, informa de ello sin inventar recomendaciones.
- `src/components/PlanEvidence.tsx`: ahora ofrece únicamente fuentes, versiones y límites, sin duplicar cifras y gráficos.
- Opciones más limpia: elimina el enlace de duplicación de escenarios; se accede a los cuadros desde Plan.
- En datos de demostración, las duraciones de cultivos se toman de `backend/datasets/cultivos.json` del repo (papa 165, quinua 200, tarwi 190, haba 190, cebada 165, avena 140), con fechas de siembra **ilustrativas** dentro de las ventanas; la cosecha se calcula sumando dichos días. Se indica explícitamente que no son fechas personalizadas.
- El mismo shock base se comparte entre las tres alternativas de la demo. Las estadísticas de cada grupo se calculan de los mismos casos individuales, sin fórmulas independientes. El promedio ilustrativo de Economía supera al de Suelo y Agua en el ejemplo.
- Presentación monetaria en USD usando referencia fija del 13/11/2026 (1 USD = 3.405 PEN, cierre BCRP). El motor conserva PEN y la tasa puede actualizarse mediante `VITE_USD_PEN_RATE` y `VITE_USD_RATE_DATE` (no es un feed en vivo).
- Inicio de chatbot con tres botones de acción (sin textos repetidos).

## Lo que NO se debe afirmar

- Una campaña por año agrícola **es la regla actual del motor**, no una restricción universal para los agricultores. Véase `backend/app/engine/rotations.py`.
- Las fechas reales de cosecha son estimadas por la regla `cosecha = siembra + duracion_dias` del motor; no están ajustadas a una predicción meteorológica futura individual.
- Los intervalos entre campañas no significan terreno vacío; el motor todavía no optimiza una segunda campaña dentro de un año.
- Los casos típicos no constituyen el futuro más probable y los porcentajes de ganancia en casos simulados no son probabilidades calibradas.
- En modo mock, las cifras no son pronósticos agrícolas reales. Para ejecutar el backend Python, debe configurarse `VITE_USE_LOCAL_MOCKS=false` y el motor de Plotterra aparte.

## Cómo ejecutar

```powershell
npm install
npm run dev:frontend # Solo la interfaz (la explicación de IA indicará que falta servidor)
# o:
npm run dev          # Vite + servidor de IA, requiere .env.ai privado con OPENAI_API_KEY
npm run test:guide
npm run build
```

La API agrícola Python del repositorio `Osomar1705/Plotterra/backend` no está dentro de este ZIP. No confundas el servidor Node para GPT con el motor agronómico real. Para usar el backend real, levantar FastAPI por separado y configurar `.env` de Vite con `VITE_USE_LOCAL_MOCKS=false`.
