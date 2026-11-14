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
| [`frontend/`](frontend) | App web en Vite + React + TypeScript: mapa para dibujar la parcela, comparación de alternativas y plan por campañas |

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

- Backend: Docker en Render (`backend/render.yaml`).
- Frontend: sitio estático en Render (`frontend/render.yaml`) o Vercel (`frontend/vercel.json`).

`VITE_API_BASE_URL` tiene que apuntar a la URL pública del backend, terminada en `/api/v1`.
