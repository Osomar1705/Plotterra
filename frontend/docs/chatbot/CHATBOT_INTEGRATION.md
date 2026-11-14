# Guía FieldShift — Implementación AI-first con GPT-4o mini

## Decisión arquitectónica

**La IA es real por defecto.** `VITE_GUIDE_MODE=ai` lleva todas las consultas a un servidor Node local (`server/ai-server.mjs`) que llama a **OpenAI Responses API** usando `OPENAI_MODEL=gpt-4o-mini`. El navegador NO conoce la clave API. El código determinista `demoAdvisor.ts` sigue únicamente como modo de pruebas explícito (`VITE_GUIDE_MODE=demo`) y no se usa durante la ejecución normal.

El motor agronómico sigue siendo otra pieza separada: `VITE_USE_LOCAL_MOCKS=true` usa cifras de ejemplo para las vistas agrícolas **pero el chatbot sigue usando GPT-4o mini**. Para producción, el backend real debe devolver los objetos `Comparison` y los indicadores por campaña.

## Inicio rápido en Windows PowerShell

Desde la carpeta extraída que contiene `package.json`:

```powershell
npm install
Copy-Item .env.ai.example .env.ai
notepad .env.ai
```

Reemplaza `pega_tu_clave_aqui` por tu clave en `OPENAI_API_KEY=`. Mantén `OPENAI_MODEL=gpt-4o-mini`. **No la envíes por chat ni la guardes en GitHub.**

```powershell
npm run dev
```

Abre http://localhost:5173. `npm run dev` arranca **dos procesos**: frontend Vite en `:5173` y proxy IA Node en `127.0.0.1:8787`. Antes de abrir la web puedes comprobar http://127.0.0.1:8787/health, que debe devolver `ready:true` (sin revelar la clave). Si la clave falta, el chat muestra el error de configuración **sin fabricar respuestas deterministas**.

Para reiniciar después de cambiar la clave: `Ctrl+C`, luego `npm run dev`.

`npm run dev:frontend` lanza solo Vite; `npm run dev:ai` lanza solo el servidor IA.

## Flujo técnico

```text
React / GuideDrawer
   | POST /api/v1/consultas
   v
Vite proxy (solo desarrollo) --> Node servidor IA (:8787) -- OPENAI_API_KEY --> Responses API
   |                                                     |
   |                                                   JSON estructurado
   v                                                     v
Guía FieldShift <------------------------------------ validador de escenarios
   |
   | Si status=proposed_change: mostrar confirmación (SIN calcular)
   v
POST /comparaciones/{id}/cambios (motor agrícola / mock)
   | Nueva Comparison
   v
Segundo POST /consultas (resumen con IA real de resultados actualizados)
```

La IA recibe el contexto de las tres vistas (`page`, `parcel`, `comparison`, `selectedAlternativeId`, `campaignIndex`) y hasta 12 turnos del historial. La petición incluye únicamente los datos que el frontend ya dispone; el servidor recorta los campos y el tamaño. No tiene acceso directo a una base de datos ni a datos satelitales nuevos.

### Request

```json
{
  "conversation_id": "fs_123",
  "message": "¿Por qué Quinua va en esta posición?",
  "page": "plan",
  "history": [
    {"role":"user","text":"¿Cuál usa menos agua?"},
    {"role":"assistant","text":"Agua requiere 260 mm, según los resultados mostrados."}
  ],
  "context": {
    "page": "plan",
    "parcel": {"locality":"Ambo, Huánuco","areaHa":3.5,"previousCrop":"Papa","priority":"water"},
    "comparison": {"id":"cmp_demo_base","sourceResult":"mock","priority":"water","alternatives":[],"activeChanges":[]},
    "selectedAlternativeId": "alt_water",
    "campaignIndex": 0
  }
}
```

En la aplicación real `alternatives` contiene las **tres alternativas completas** calculadas por el backend o los mocks. Este ejemplo omite los campos restantes para legibilidad.

### Respuestas

La IA devuelve un JSON con los siguientes estados:

- `answered`: responde de forma natural, sin cambio.
- `needs_clarification`: pide información (p. ej., porcentaje de riego).
- `proposed_change`: propone una acción validada **sin ejecutarla**.
- `unsupported`: informa que no puede respaldar la consulta/escenario.

Campos: `status`, `intent`, `message`, `suggestions[]`, `sources[]`, `change` (o null), `requires_confirmation`.

Ejemplo de propuesta:

```json
{
  "status":"proposed_change",
  "intent":"PROPOSE_SCENARIO",
  "message":"Entiendo que quieres evaluar 30 % menos riego. ¿Recalculamos tus tres opciones?",
  "suggestions":[],
  "sources":[],
  "change":{"type":"irrigation","operation":"reduce","value":30,"unit":"percent","label":"Riego −30%"},
  "requires_confirmation":true
}
```

## Seguridad y comportamiento responsable

1. La API key solo existe en `.env.ai`, ignorado por `.gitignore`. **No usar `VITE_OPENAI_API_KEY`**: las variables `VITE_*` son visibles en el bundle del navegador.
2. El servidor usa `store:false` en Responses API; el historial permanece temporalmente en React y se reenvía en cada solicitud. Revisa las políticas de retención aplicables al uso de tu cuenta/API.
3. El modelo genera la conversación y la propuesta estructurada. El servidor valida el tipo, valor, operación y página de cualquier cambio. Se permite reducir el riego 1–99 %, excluir cebada o poner papa primero; no se ejecuta sin confirmación.
4. En `sourceResult:mock` **solo** se acepta el escenario `Riego −30%` porque es el único con resultados disponibles. Los demás escenarios necesitan motor real.
5. El backend agrícola es la autoridad sobre los KPIs. GPT no debe inventar márgenes, precipitaciones ni supuestos agronómicos. Las explicaciones por cultivo NO afirman mejoras agrícolas sin datos por campaña.
6. Las etapas visuales `40 casos base / 100 escenarios` son **ilustrativas** hasta validación del motor.
7. El proxy aplica límites de tamaño, CORS limitado y un rate limit simple por IP. **Antes de publicar a Internet** agregar autenticación, cuotas/costos por usuario, logging seguro, limitación robusta y un origen confiable. El proxy actual está orientado a desarrollo y demo.

## Integración con backend real (sin mocks)

Mantener `.env.ai` y configurar el frontend (en `.env.local`):

```dotenv
VITE_USE_LOCAL_MOCKS=false
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
VITE_GUIDE_MODE=ai
VITE_GUIDE_API_URL=/api/v1/consultas
```

Las operaciones agrícolas irán a FastAPI `:8000`, mientras que Vite dirigirá únicamente `/api/v1/consultas` y `/api/v1/guide-health` al proxy IA `:8787`. No hace falta que FastAPI comparta la clave OpenAI.

Para producción con hosting separado, despliega Node como servicio de backend y configura `VITE_GUIDE_API_URL=https://TU-SERVIDOR/api/v1/consultas` **antes del build**; ajusta `FIELD_GUIDE_ALLOWED_ORIGINS` y `FIELD_GUIDE_HOST` en el servidor. Si es posible, pon el endpoint detrás de un reverse proxy en el mismo dominio.

## Pruebas

```powershell
npm run test:guide
npm run build
```

Las pruebas automatizadas no usan clave real ni envían solicitudes a OpenAI: simulan el endpoint, verifican JSON estructurado, historial y validación de acciones. Para verificar la API real, configura tu clave localmente y pregunta:

1. `¿Cómo funciona FieldShift?`
2. `¿De dónde salen los datos?`
3. En Opciones, `¿Cuál usa menos agua y cuánto menos que Economía?`
4. `¿Qué pasa si tengo menos riego?` → debe pedir aclaración.
5. `30% menos riego` → debe proponer, confirmar, cerrar chat, simular, volver con **respuesta generada por la IA** basada en cifras nuevas.
6. En Plan, selecciona `Quinua` y pregunta `¿Por qué va aquí?` → debe usar la campaña actual.
7. `¿Qué pesticida compro?` → no recomendar tratamientos sin respaldo.

## Archivos relevantes

- `server/guide-engine.mjs`: prompt y restricciones del modelo, esquema JSON y validación posterior.
- `server/ai-server.mjs`: servidor con clave privada, CORS, límites y salud.
- `scripts/dev-with-ai.mjs`: inicia Vite + proxy IA con un único comando.
- `src/assistant/guideApi.ts`: adaptador HTTP del frontend.
- `src/assistant/GuideDrawer.tsx`: conversación, confirmaciones y resumen AI-first.
- `src/assistant/GuideProvider.tsx`: contexto React del agricultor.
- `tests/guide-engine.test.mjs`: pruebas sin clave.

Referencias OpenAI: https://developers.openai.com/api/docs/models/gpt-4o-mini, https://developers.openai.com/api/docs/guides/structured-outputs, https://developers.openai.com/api/docs/guides/text-generation.
