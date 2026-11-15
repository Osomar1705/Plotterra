# FieldShift NSC Frontend

## Novedades: "Tu chacra en 100 futuros"

Implementa el plan `docs/FIELDSHIFT_PLAN_FRONTEND.md` (Fases 0–5). Capturas en `docs/capturas/`.

| Qué | Dónde |
|---|---|
| Cuadrícula de 100 futuros (una parcelita por escenario; pérdidas con color **y** rayado) | `src/components/futures/FuturesGrid.tsx` |
| "Gana en X de 100" + promedio + 10 peores futuros en cada tarjeta | `src/components/AlternativeCard.tsx` |
| Hover compartido: el mismo futuro se ilumina en las 3 opciones | `ComparisonPage.tsx` (`hovered`) |
| Panel "Los 100 futuros de tu parcela" (orden por resultado o por tipo de futuro, stress test, plan habitual) | `src/components/futures/FuturesPanel.tsx` |
| Simulación animada con datos reales (sin progreso inventado) que viaja a la tarjeta destacada | `src/components/futures/SimulationReveal.tsx` |
| Ilustraciones propias de los 6 cultivos + paisaje andino | `src/components/CropIllustration.tsx` |
| Vista 03 renovada: línea de tiempo de 3 años, detalle de campaña, 100 futuros vs. plan habitual, "por qué este plan" | `src/features/routes/DecisionRoutesPage.tsx`, `plan.css` |
| Mocks deterministas con la misma forma que el backend | `src/mocks/futures.ts`, `src/mocks/data.ts` |

**Campos opcionales nuevos de la API** (si faltan, la UI vuelve al diseño anterior): `alternatives[].outcomes.margin_by_scenario` (o `detalle.distribucion_margen_S_ha`), `outcomes.wins/losses/mean/adverse`, `detalle.stress_test/explicacion/tradeoffs`, `campaigns[].crop_id/start_month/end_month/metrics`, `scenarios[]` (o `simulacion.escenarios`), `usual_plan`, `rainfall_monthly_mm`. Ejemplo real: `docs/ejemplo_respuesta_backend.json`.

**Otros cambios:** versiones fijadas en `package.json` (antes `latest`), única librería nueva `motion@14.6.0`, se quitaron las esperas artificiales (4,8 s y 8,9 s) y el overlay con pasos simulados de la Vista 01, se respeta `prefers-reduced-motion`.

**v2 (más visual y compacta):**
- **Tarjetas de opciones compactas y cuadradas:** cultivos en 3 casillas iguales; los 100 futuros (cuadritos de 9 px) junto al número animado; agua, suelo y riesgo en 3 chips del mismo tamaño.
- **Cuadritos más pequeños** en el panel y la Vista 03 (15 px).
- **Vista 03 más corta:**
  - Indicadores dentro de la cabecera.
  - Detalle de campaña integrado en la línea de tiempo.
  - "100 futuros" y "Por qué este plan" lado a lado.
- **Animaciones:** conteos animados, entrada escalonada de tarjetas y cultivos, barras de lluvia y de estrés que crecen, efecto Ken Burns en las fotos y balanceo de las ilustraciones al pasar el cursor.
- **Fotos reales** (`src/components/Photo.tsx`):
  - Tres fotos de Wikimedia Commons (andenes del Colca, quinua en Apurímac, variedades de papa), con crédito y enlace a su página.
  - Las carga el navegador del usuario. Si no cargan, se muestra la ilustración propia.
  - **Antes de publicar, revisar la licencia de cada una en su enlace.**

**Pendiente opcional:** foto real con crédito en la cabecera (este entorno no pudo descargar imágenes de Wikimedia; reemplazar `AndeanLandscape` por una `<img>` con crédito si se consigue), imagen satelital de fondo en el mapa (F5) y bienvenida estilo Tend (F6).

---

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

## Novedades v4 · Guía FieldShift (chatbot) integrada

**Cómo correrlo**
1. `npm install`
2. Copia `.env.ai.example` → `.env.ai` y pon tu clave en `OPENAI_API_KEY=` (solo servidor; nunca en variables `VITE_*`, nunca en GitHub ni por chat).
3. `npm run dev` → levanta Vite (5173) + servidor IA (8787). Sin clave: `VITE_GUIDE_MODE=demo npm run dev:frontend` (respuestas sin LLM).
4. `npm run test:guide` → pruebas del servidor IA.

**Qué cambió respecto al chat original**
- Integrado con el rediseño: al confirmar un cambio desde el chat se ve la animación de los 100 casos y luego vuelve el chat.
- Bienvenida que dice qué puede y qué no puede hacer + 3 preguntas de inicio según la página.
- Tarjeta "Resultado del simulador" con cifras del motor (gana en X de 100, antes → después) y botón **Deshacer**.
- La IA recibe `outcomes` (gana en X de 100, promedio, 10 peores) y `stressTest`; se le pide hablar en frecuencias ("8 de cada 10 casos"), nunca como garantía.
- `context.engine` (`backend` / `local_mock`): con backend real acepta cualquier cambio validado; en mock solo 30 % menos riego.
- Error con **Reintentar**, aviso claro si la IA no está conectada, dictado por voz (si el navegador lo soporta) y lectura en voz alta con detener.
- Acciones sobre el objeto: "¿Por qué? 💬" en cada tarjeta, "Preguntar por este plan" y "¿Por qué aquí?" en la vista Plan.
- Móvil: el chat es una hoja inferior; sugerencias en fila deslizable.
- Se quitó la foto flotante del encabezado de la Vista 01 (redundante).

**Ojo backend:** el Vite proxy envía `/api/v1/consultas` al servidor IA (8787). El backend de referencia también tenía `/consultas` (por reglas); usen solo uno.

## v8 · Vista Plan compacta
- Una sola tarjeta de plan (margen, agua, suelo) + 3 siembras con solo fecha de siembra → cosecha. Al tocar una siembra aparece "Why X here?" con datos del run (posición en la rotación, lluvia típica entre siembra y cosecha, métricas si el backend las manda) y botón "Ask the guide".
- Cuadritos en vertical a la derecha, agrupados por tipo de prueba; al pasar el cursor se lee el caso exacto (años de clima + condición).
- Fuentes y límites en un solo desplegable bajo el plan. La sección "Why this plan?" con IA se quitó de la vista (el componente PlanWhyAI.tsx queda sin usar, por si se reutiliza en el detalle de siembra).
- (v8.1) Nueva tarjeta "What hurts this plan most?": barras con cuánto baja el margen en cada prueba vs. condiciones típicas + rango peor 10 / promedio / mejor 10. Se calcula de los mismos 100 resultados. Fuentes/límites ahora son el pie de la tarjeta del plan. La lluvia en el detalle de siembra se rotula "historical average (not a forecast)".
- (v8.2) Fuentes/límites pasaron al final de la tarjeta de riesgo con la lista de datos que usa el motor.
- (v8.3) Se restauró la animación "Testing your plot in 100 possible futures" al llegar a Opciones desde el formulario (no se repite al volver desde Plan).
