# FieldShift NSC Frontend

Implementación React + TypeScript del recorrido del agricultor.

- **Vista 01 — Parcela** (Integrante 1): entrada de la parcela y condiciones.
- **Vista 02 — Opciones** (Integrante 2): comparación de alternativas, escenarios y asistente.
- **Vista 03 — Plan** (Integrante 3): pasaporte de campaña, pendiente.

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

- `POST /parcelas`
- `POST /comparaciones`
- `GET /comparaciones/{id}`
- `POST /comparaciones/{id}/cambios`
- `DELETE /comparaciones/{id}/cambios/{id}`
- `POST /consultas`
- Vista 03 puede usar `GET /comparaciones/{id}/alternativas/{id}/pasaporte`

El normalizador soporta nombres de campos comunes en español/inglés para facilitar la primera integración, pero una vez congelados los schemas Pydantic conviene eliminar aliases innecesarios.


## Vista 01 — Parcela (Integrante 1)

Captura el terreno y las condiciones, y entrega el contexto a Opciones.

### Qué incluye

- Mapa con dibujo de polígono: añadir puntos, deshacer el último, borrar y cerrar el contorno.
- Área calculada en hectáreas en vivo, junto al polígono y no en un campo aparte.
- Validación de geometría en cliente: mínimo tres puntos, sin lados cruzados, superficie entre 0.05 y 50 ha.
- Salida alternativa para quien no puede dibujar en el celular: escribir las hectáreas a mano.
- Condiciones: cultivo anterior (con «No lo sé»), fecha de inicio, agua disponible, cultivos permitidos con motivo de exclusión, prioridad y plan habitual opcional.
- Los seis estados: mapa vacío, dibujando, parcela cerrada, contorno inválido, cálculo en curso y ubicación rechazada.
- Acción principal que dice qué falta en vez de fallar al pulsarla; en móvil queda fija al pie.

### Estados y mensajes

| Estado | Qué cambia | Acción principal |
| --- | --- | --- |
| Mapa vacío | Tarjeta de ayuda, «Editar» y «Borrar» apagados | Bloqueada: «Falta dibujar tu parcela» |
| Dibujando | Línea abierta, contador de puntos, «Deshacer último punto» | «Cerrar parcela» |
| Parcela cerrada | Polígono relleno y superficie en hectáreas | «Comparar mis opciones» |
| Contorno inválido | Polígono en rojo con el cruce señalado | Bloqueada: «Corrige el contorno de tu parcela» |
| Cálculo en curso | Capa sobre el contenido, sin porcentaje inventado | Deshabilitada |
| Ubicación rechazada | Búsqueda por localidad y «Escribir hectáreas» | Bloqueada: «Falta ubicar tu parcela» |

### Backend que consume

`POST /parcelas` con la geometría o la superficie declarada. Devuelve `parcela_id`, `area_ha` y
sugerencias ambientales corregibles. En modo mock se respeta el área del polígono dibujado.

### Entrega a Vista 02

Al pulsar «Comparar mis opciones» se guarda el contexto y se navega:

```ts
saveEntryConditions({ plotId, areaHa, startDate, previousCrop, waterMode,
  irrigationMm, allowedCrops, excludedCrops, priority, horizon: 3 });
window.history.pushState({}, '', '/opciones');
window.dispatchEvent(new PopStateEvent('popstate'));
```

`excludedCrops` lleva el motivo que dio el agricultor (`sin_comprador`, `no_en_mi_zona`,
`no_quiero`): es su experiencia entrando como dato y puede reaparecer en la explicación del plan.

### Pendiente

- El mapa es un lienzo SVG con geometría propia. Al integrar un mapa real, se reemplaza
  `src/lib/plotGeometry.ts` por el cálculo geodésico y la vista no cambia.
- La captura satelital real de la zona piloto sustituye al fondo dibujado.

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
    EntryPage.tsx       # Vista 01
    PlotMap.tsx         # mapa y dibujo del poligono
    ComparisonPage.tsx
    AlternativeCard.tsx
    AssistantDrawer.tsx
    Icons.tsx
  lib/
    plotGeometry.ts     # area, auto-interseccion y validacion
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
