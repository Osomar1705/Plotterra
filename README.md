# Plotterra

Comparador de rotaciones de cultivo para pequeños agricultores de Huánuco (Perú).
Proyecto para NASA Space Apps, reto *adapting farms*. Antes se llamaba FieldShift.

El agricultor dibuja su parcela en un mapa satelital y cuenta sus condiciones (agua,
cultivo anterior, cultivos que puede sembrar). La app compara tres rotaciones de tres
campañas: la de mejor margen, la que menos agua necesita y la que mejor cuida el
suelo. Cada una se evalúa en 100 escenarios de lluvia y precio.

## Estructura

| Carpeta | Qué es |
|---|---|
| [`backend/`](backend) | API en FastAPI (Python 3.11): motor de balance hídrico FAO-56, escenarios, rotaciones y datasets de los 84 distritos de Huánuco |
| [`frontend/`](frontend) | App web en Vite + React + TypeScript: mapa satelital para dibujar la parcela, comparación de alternativas en 100 futuros, plan por campañas y la Guía (chat) |

Cada carpeta conserva su historial completo, con las fechas y los autores originales.
Antes vivían como dos repos separados.

## Datos de la NASA que usa

- **NASA POWER**: ET0 y días de lluvia diarios.
- **NASA HLS** (Landsat 8/9 + Sentinel-2, 30 m): verdor (NDVI) de la parcela y de las chacras de cada distrito.
- **NASA ECOSTRESS** (ESI): estrés hídrico de la vegetación.

Además: CHIRPS (lluvia mensual), ISRIC SoilGrids (suelo) e INEI (costos y rendimientos).
El detalle está en [`backend/datasets/FUENTES.md`](backend/datasets/FUENTES.md).

## Correrlo en local

Backend:

```bash
cd backend
uv venv --python 3.11 && uv pip install -r requirements.txt
cp .env.example .env
FIELDSHIFT_MOTOR=real .venv/bin/uvicorn app.main:app --port 8000
```

Frontend, en otra terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Abrir http://localhost:5173.

## Deploy

Todo lo necesario está en el repo: los datos van en `backend/datasets/` (9 MB) y la
base SQLite se crea sola al arrancar.

En Render: **New → Blueprint** → elegir este repo. El [`render.yaml`](render.yaml) de la
raíz crea los dos servicios:

- `plotterra-backend`: Docker con el motor real. Revisión de salud en `/api/v1/health`.
- `plotterra-frontend`: sitio estático. Reenvía `/opciones` y `/plan` a la app.

Si Render le da al backend otro subdominio, hay que cambiar `VITE_API_BASE_URL` y
`VITE_GUIDE_API_URL` en el frontend y volver a desplegar.

**Guía (chat):** en el deploy usa `/consultas` del backend. Sin clave responde el intérprete
por reglas; con `ANTHROPIC_API_KEY` en el backend, responde un LLM. El frontend también trae
un servidor propio con OpenAI (`frontend/server/`, se arranca con `npm run dev`). Para usarlo
en producción hay que desplegarlo aparte, con `OPENAI_API_KEY`, y apuntar a él
`VITE_GUIDE_API_URL`.

En el plan gratuito el backend se apaga cuando no se usa: la primera petición tarda
unos 50 segundos. Conviene abrirlo un rato antes de una demo.

Como alternativa, el frontend también se puede desplegar en Vercel (`frontend/vercel.json`).
En ese caso hay que elegir `frontend` como Root Directory.
