"""Salud y catalogo. No contienen logica de calculo."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.validaciones import (
    AREA_MAX_HA,
    AREA_MIN_HA,
    CULTIVOS_MINIMOS,
    LAMINA_MAX_MM,
    PLAN_HABITUAL_CULTIVOS,
    VERTICES_MINIMOS,
)
from app.config import CONFIG
from app.data.repository import REPO
from app.engine.contrato import VERSION_MOTOR
from app.schemas.catalogo import (
    Catalogo,
    CeldaCobertura,
    CultivoCatalogo,
    LimiteNumerico,
    LimitesValidacion,
    VentanaSiembra,
)
from app.schemas.comun import ModoAgua, Prioridad

router = APIRouter(tags=["servicio"])


@router.get("/health", summary="Comprobar que el servicio y los datasets estan cargados")
def health() -> dict:
    return {
        "estado": "ok" if REPO.listo else "sin_datasets",
        "motor": CONFIG.motor,
        "version_motor": VERSION_MOTOR,
        "version_datasets": REPO.version_datasets if REPO.listo else None,
        "cultivos_cargados": len(REPO.fichas) if REPO.listo else 0,
        "celdas_con_cobertura": [c["celda_id"] for c in REPO.celdas] if REPO.listo else [],
    }


@router.get("/guide-health", summary="Estado del interprete de la Guia (chat) del frontend")
def guide_health(probe: bool = False) -> dict:
    """La Guia del frontend pregunta esto antes de abrir el chat.

    Cuando no hay servidor de IA propio, el frontend manda sus consultas a
    /consultas de este backend: con clave usa el LLM y, sin ella, el interprete
    por reglas. Las dos opciones responden, asi que ready es siempre true.

    Con ?probe=true hace una llamada minima al modelo y dice si funciona y,
    si no, por que (clave invalida, sin saldo, modelo...). Nunca muestra la clave.
    """
    from app.llm.cliente import probar, ultimo_error

    con_llm = bool(CONFIG.anthropic_api_key)
    salida = {
        "ready": True,
        "provider": "anthropic" if con_llm else "reglas",
        "model": CONFIG.modelo_llm if con_llm else "interprete por reglas",
        "message": "Guia conectada al motor FieldShift",
        "last_llm_error": ultimo_error(),
    }
    if probe:
        salida["probe"] = probar()
    return salida


@router.get("/catalogo", response_model=Catalogo, summary="Cultivos, prioridades, unidades y limites")
def catalogo() -> Catalogo:
    cultivos = [
        CultivoCatalogo(
            cultivo=clave,
            nombre=f.nombre,
            familia=f.familia,
            duracion_dias=f.duracion_dias,
            ventana_siembra=[VentanaSiembra(desde=d, hasta=h) for d, h in f.ventana_siembra],
            rendimiento_ref_t_ha=f.rendimiento_ref_t_ha,
            precio_soles_kg_mediana=f.precio_soles_kg["mediana"],
            provisional=f.provisional,
            fuente=f.fuente,
        )
        for clave, f in sorted(REPO.fichas.items())
    ]
    return Catalogo(
        cultivos=cultivos,
        prioridades=[p.value for p in Prioridad],
        modos_agua=[m.value for m in ModoAgua],
        limites=LimitesValidacion(
            area_ha=LimiteNumerico(minimo=AREA_MIN_HA, maximo=AREA_MAX_HA, unidad="ha"),
            lamina_mm_campania=LimiteNumerico(minimo=0, maximo=LAMINA_MAX_MM, unidad="mm"),
            vertices_minimos=VERTICES_MINIMOS,
            cultivos_permitidos_minimos=CULTIVOS_MINIMOS,
            plan_habitual_cultivos=PLAN_HABITUAL_CULTIVOS,
            horizonte_campanias_maximo=3,
        ),
        cobertura=[
            CeldaCobertura(
                celda_id=c["celda_id"],
                localidad=c["localidad"],
                lluvia_media_campania_mm=c.get("lluvia_media_campania_mm")
                or REPO.lluvia_media_campania_mm(c["celda_id"]),
                fuente_clima=c["fuente_clima"],
            )
            for c in REPO.celdas
        ],
        version_datasets=REPO.version_datasets,
        version_motor=VERSION_MOTOR,
    )
