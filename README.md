# FieldShift NSC Frontend — Vista 02 (Opciones)

Implementación React + TypeScript de la parte del **Integrante 2**: comparación de alternativas, prueba de escenarios y asistente.

## Qué incluye

- 02A: comparación inicial con Economía / Agua / Suelo.
- 02B: selección local de cambio (sin alterar cifras todavía).
- 02C: estado de recálculo, bloqueando doble envío.
- 02D: comparación actualizada + Deshacer.
- Chat 1/2/3: consulta → interpretación → confirmación → resultado.
- Adaptador API para el backend FastAPI bajo `/api/v1`.
- Mocks locales para trabajar sin backend.
- Handoff a Vista 03 con `comparisonId + alternativeId`.
- Integración desde Vista 01 con `sessionStorage` o query params.

## Ejecutar

```bash
npm install
cp .env.example .env
npm run dev
```

### Con backend real

En `.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
VITE_USE_LOCAL_MOCKS=false
```

Backend esperado:

- `POST /comparaciones`
- `GET /comparaciones/{id}`
- `POST /comparaciones/{id}/cambios`
- `DELETE /comparaciones/{id}/cambios/{id}`
- `POST /consultas`
- Vista 03 puede usar `GET /comparaciones/{id}/alternativas/{id}/pasaporte`

El normalizador soporta nombres de campos comunes en español/inglés para facilitar la primera integración, pero una vez congelados los schemas Pydantic conviene eliminar aliases innecesarios.

## Integración con Vista 01

Antes de navegar a Opciones:

```ts
import { saveEntryConditions } from './integration/entryContext';

saveEntryConditions({
  plotId: 'parcela_001',
  areaHa: 3.5,
  priority: 'economy',
  startDate: '2026-10-01',
  previousCrop: 'maiz',
  waterMode: 'irrigated',
  irrigationMm: 340,
  allowedCrops: ['papa','quinua','maiz','cebada'],
  horizon: 3,
});
window.location.href = '/opciones';
```

También acepta `?plotId=...` o `?comparisonId=...`.

## Integración con Vista 03

`Ver mi plan` emite:

```ts
window.addEventListener('fieldshift:open-plan', (event) => {
  // event.detail = { comparisonId, alternativeId }
});
```

y actualiza la URL a:

```txt
/plan?comparisonId=...&alternativeId=...
```

El integrante de Plan puede reemplazar ese comportamiento por React Router sin tocar `AlternativeCard` ni la capa API.

## Errores

La UI consume la forma uniforme del backend:

```json
{
  "error": {
    "codigo": "AREA_FUERA_DE_RANGO",
    "campo": "area_ha",
    "mensaje_tecnico": "...",
    "mensaje_agricultor": "Ese terreno es más grande de lo que podemos analizar.",
    "accion_sugerida": "corregir",
    "run_id": "run_4a8d"
  }
}
```

En pantalla se prioriza `mensaje_agricultor`; `run_id` queda visible para soporte.

## Estructura

```txt
src/
  api/
    fieldshiftApi.ts    # llamadas HTTP / mocks
    normalizers.ts      # backend -> modelo UI
  components/
    ComparisonPage.tsx
    AlternativeCard.tsx
    AssistantDrawer.tsx
    Icons.tsx
  integration/
    entryContext.ts     # contrato con Vista 01
  mocks/
    data.ts
  types/
    fieldshift.ts       # tipos compartidos
  styles/
    global.css
```

## Decisiones importantes

1. Frontend **no calcula** margen, agua, riesgo o compatibilidad.
2. Un cambio rápido solo se vuelve activo cuando Backend termina el recálculo.
3. Durante 02C se conserva la comparación anterior.
4. El asistente interpreta y explica; no inventa métricas.
5. `comparisonId + alternativeId` son suficientes para el handoff de `Ver mi plan`.
