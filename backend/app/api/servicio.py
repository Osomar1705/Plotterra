"""Orquestacion de una comparacion: validar, cachear, calcular, registrar.

Vive aqui y no en los routers para que routes_*.py no tenga logica: convierten
HTTP en objetos Pydantic y de vuelta, nada mas.
"""
from __future__ import annotations

import time
from datetime import datetime
from typing import Any

from app.api.errors import ErrorFieldShift
from app.api.validaciones import validar_condiciones
from app.config import CONFIG
from app.data.cache import clave_cache
from app.data.identificadores import nuevo_id
from app.data.repository import REPO, DatosNoDisponibles, ahora_iso
from app.engine.contrato import Condiciones
from app.engine.puerta import ejecutar_comparacion, fuente_resultado
from app.schemas.comparacion import (
    FAMILIA_EN,
    EscenarioResumen,
    Motor,
    RespuestaComparacion,
    ResumenDelCambio,
    Simulacion,
)
from app.engine.contrato import VERSION_MOTOR
from app.schemas.entrada import CondicionesComparacion
from app.schemas.errores import CodigoError


def _condiciones_motor(cond: CondicionesComparacion, permitidos: list[str], area_ha: float) -> Condiciones:
    return Condiciones(
        parcela_id=cond.parcela_id,
        area_ha=area_ha,
        fecha_inicio=cond.fecha_inicio,
        cultivo_anterior=cond.cultivo_anterior,
        modo_agua=cond.agua.modo.value,
        lamina_mm_campania=float(cond.agua.lamina_mm_campania or 0.0),
        cultivos_permitidos=permitidos,
        prioridad=cond.prioridad.value,
        plan_habitual=cond.plan_habitual,
        cultivos_fijados={int(k): v for k, v in cond.cultivos_fijados.items()},
        horizonte_campanias=cond.horizonte_campanias,
        n_escenarios=cond.escenarios.n,
        semilla=cond.escenarios.semilla,
        factor_lluvia=cond.factor_lluvia,
        factor_precio=cond.factor_precio,
    )


def _simulacion(escenarios: list[dict[str, Any]]) -> Simulacion | None:
    """Los escenarios simulados, con la familia en el nombre corto del frontend."""
    if not escenarios:
        return None
    return Simulacion(
        escenarios=[
            EscenarioResumen(
                id=e["escenario_id"],
                familia=FAMILIA_EN.get(e["familia"], e["familia"]),
                anio_clima=e["anio_base"],
                anios_clima=[str(e["anio_base"])],
                factor_lluvia=e["factor_lluvia"],
                factor_riego=e["factor_riego"],
                factor_precio=e["factor_precio"],
            )
            for e in escenarios
        ]
    )


def correr_comparacion(
    cond: CondicionesComparacion,
    *,
    cambios: list[dict[str, Any]] | None = None,
    derivada_de: str | None = None,
) -> RespuestaComparacion:
    cambios = cambios or []
    parcela = REPO.parcela(cond.parcela_id)
    if parcela is None:
        raise ErrorFieldShift(
            CodigoError.NO_ENCONTRADO,
            f"parcela {cond.parcela_id} inexistente",
            campo="parcela_id",
            mensaje_agricultor="No encontramos esa parcela. Vuelve a dibujarla para comparar.",
        )

    permitidos = validar_condiciones(cond, REPO.fichas)

    try:
        datasets = REPO.datasets_de(parcela["celda_id"])
    except DatosNoDisponibles as exc:
        raise ErrorFieldShift(CodigoError.DATOS_NO_DISPONIBLES, str(exc), campo="parcela_id") from exc

    condiciones_json = cond.model_dump(mode="json")
    clave = clave_cache(
        geometria=parcela["geometria"],
        area_ha=parcela["area_ha"],
        condiciones=condiciones_json,
        cambios=cambios,
        # El modo (real/mock) y la version del motor: si cambian las formulas,
        # una respuesta guardada con las viejas no debe volver a servirse.
        version_motor=f"{CONFIG.motor}-{VERSION_MOTOR}",
        version_datasets=REPO.version_datasets,
    )

    # Camino de la cache: si la clave existe, la respuesta sale de disco.
    guardada = REPO.respuesta_por_clave(clave)
    if guardada is not None:
        respuesta = RespuestaComparacion.model_validate(guardada)
        respuesta.motor.fuente_resultado = "cache"
        return respuesta

    inicio = time.perf_counter()
    resultado = ejecutar_comparacion(_condiciones_motor(cond, permitidos, parcela["area_ha"]), datasets)
    duracion_ms = int((time.perf_counter() - inicio) * 1000)

    comparacion_id = nuevo_id("comparacion")
    respuesta = RespuestaComparacion(
        comparacion_id=comparacion_id,
        parcela_id=cond.parcela_id,
        area_ha=parcela["area_ha"],
        generado_en=datetime.fromisoformat(ahora_iso()),
        derivada_de=derivada_de,
        motor=Motor(
            version=resultado.version_motor,
            semilla=cond.escenarios.semilla,
            escenarios_evaluados=resultado.escenarios_evaluados,
            rotaciones_evaluadas=resultado.rotaciones_evaluadas,
            duracion_ms=duracion_ms,
            version_datasets=REPO.version_datasets,
            fuente_resultado=fuente_resultado(),
        ),
        escenarios_aplicados=cambios,
        alternativas=resultado.alternativas,
        plan_habitual=resultado.plan_habitual,
        descartadas=resultado.descartadas,
        simulacion=_simulacion(resultado.escenarios),
    )

    REPO.registrar_ejecucion(
        comparacion_id=comparacion_id,
        parcela_id=cond.parcela_id,
        condiciones=condiciones_json,
        cambios=cambios,
        derivada_de=derivada_de,
        version_motor=resultado.version_motor,
        semilla=cond.escenarios.semilla,
        duracion_ms=duracion_ms,
        estado="listo",
        clave_cache=clave,
    )
    REPO.guardar_respuesta(comparacion_id, respuesta.model_dump(mode="json"))
    return respuesta


def resumen_del_cambio(antes: RespuestaComparacion, despues: RespuestaComparacion) -> ResumenDelCambio:
    """Delta que la pantalla muestra sobre las tarjetas despues de un cambio."""

    def destacada(r: RespuestaComparacion):
        return next((a for a in r.alternativas if a.destacada), r.alternativas[0] if r.alternativas else None)

    a, d = destacada(antes), destacada(despues)
    if a is None or d is None:
        return ResumenDelCambio(margen_delta_soles_ha=0, deficit_delta_mm=0, cambio_de_orden=True)
    orden_antes = [x.alternativa_id for x in antes.alternativas]
    orden_despues = [x.alternativa_id for x in despues.alternativas]
    return ResumenDelCambio(
        margen_delta_soles_ha=round(d.economia.margen_soles_ha_mediana - a.economia.margen_soles_ha_mediana, 0),
        deficit_delta_mm=round(d.agua.deficit_mm_mediana - a.agua.deficit_mm_mediana, 0),
        cambio_de_orden=orden_antes != orden_despues
        or [x.secuencia[0].cultivo for x in antes.alternativas] != [x.secuencia[0].cultivo for x in despues.alternativas],
    )
