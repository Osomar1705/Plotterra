"""Arranque de FastAPI y carga de datasets.

La OpenAPI que publica este archivo es el contrato: frontend maqueta contra ella
y solo se le agregan campos, nunca se renombran.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import registrar_manejadores
from app.api.routes_comparaciones import router as router_comparaciones
from app.api.routes_consultas import router as router_consultas
from app.api.routes_guide_chat import router as router_guide_chat
from app.api.routes_parcelas import router as router_parcelas
from app.api.routes_salud import router as router_salud
from app.config import CONFIG
from app.data.repository import REPO
from app.engine.contrato import VERSION_MOTOR

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("fieldshift")

DESCRIPCION = """
Servicio que recibe la parcela del agricultor, ejecuta el stress test sobre las
rotaciones posibles y devuelve tres alternativas, el pasaporte de campania y los
cambios pedidos por el chatbot.

Convenciones del contrato:

* La unidad viaja en el nombre del campo: `margen_soles_ha`, `deficit_mm`, `area_ha`.
* Todo identificador lleva prefijo legible: `prc_`, `cmp_`, `alt_`, `chg_`.
* Un cambio nunca modifica una comparacion existente: crea una derivada.
* Todos los errores salen con el mismo cuerpo, con `mensaje_agricultor` listo para mostrar.
"""


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    REPO.arrancar()
    log.info(
        "datasets cargados: %d cultivos, celdas %s, version %s, motor=%s",
        len(REPO.fichas),
        [c["celda_id"] for c in REPO.celdas],
        REPO.version_datasets,
        CONFIG.motor,
    )
    yield
    REPO.cerrar()


app = FastAPI(
    title="FieldShift API",
    version=VERSION_MOTOR,
    description=DESCRIPCION,
    lifespan=ciclo_de_vida,
)

# El frontend corre en otro origen: local, Vercel o Render. Un dominio propio se
# agrega con FIELDSHIFT_CORS_EXTRA (regex) sin tocar codigo.
_ORIGENES = r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app|https://.*\.onrender\.com"
_EXTRA = os.getenv("FIELDSHIFT_CORS_EXTRA", "").strip()

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=f"{_ORIGENES}|{_EXTRA}" if _EXTRA else _ORIGENES,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Sesion-Id"],
)

registrar_manejadores(app)

for router in (router_salud, router_parcelas, router_comparaciones, router_consultas, router_guide_chat):
    app.include_router(router, prefix=CONFIG.base_path)


@app.get("/", include_in_schema=False)
def raiz() -> dict:
    return {"servicio": "FieldShift API", "contrato": f"{CONFIG.base_path}/health", "docs": "/docs"}
