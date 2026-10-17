"""Comparaciones, pasaporte, cambios y procedencia."""
from __future__ import annotations

import json

from fastapi import APIRouter

from app.api import cambios as cambios_mod
from app.api.errors import ErrorFieldShift
from app.api.servicio import correr_comparacion, resumen_del_cambio
from app.data.identificadores import nuevo_id
from app.data.repository import REPO
from app.engine.contrato import VERSION_MOTOR
from app.llm.explain import redactar
from app.schemas.comparacion import CambioAplicado, RespuestaComparacion
from app.schemas.consultas import CambioCrear, DatosYSupuestos
from app.schemas.entrada import CondicionesComparacion
from app.schemas.errores import CodigoError
from app.schemas.pasaporte import (
    ComparacionConPlanHabitual,
    Exportable,
    Metricas,
    ParcelaResumen,
    Pasaporte,
)

router = APIRouter(tags=["comparaciones"])

SUPUESTOS = [
    "Los resultados son simulados: los rangos describen los escenarios evaluados y no son probabilidades de lo que ocurrira.",
    "Los precios son referencias de mercado, no cotizaciones del comprador del agricultor.",
    "El indice de suelo expresa compatibilidad agronomica de la secuencia, no un cambio medido de fertilidad.",
    "El motor no decide: devuelve alternativas comparables y sus limites.",
]
LIMITACIONES = [
    "La escala de los productos NASA es regional y se complementa con informacion local.",
    "Cuando el suelo viene de una estimacion y no de un analisis, la calidad de informacion baja a limitada.",
    "Riesgo y calidad de informacion son indicadores distintos: un plan puede salir bien evaluado y estar sostenido por datos pobres.",
]


def _recuperar(comparacion_id: str) -> RespuestaComparacion:
    cuerpo = REPO.respuesta(comparacion_id)
    if cuerpo is None:
        raise ErrorFieldShift(
            CodigoError.NO_ENCONTRADO,
            f"comparacion {comparacion_id} inexistente",
            campo="comparacion_id",
        )
    return RespuestaComparacion.model_validate(cuerpo)


def _condiciones_de(comparacion_id: str) -> tuple[CondicionesComparacion, list[dict]]:
    fila = REPO.ejecucion(comparacion_id)
    if fila is None:
        raise ErrorFieldShift(
            CodigoError.NO_ENCONTRADO,
            f"ejecucion {comparacion_id} inexistente",
            campo="comparacion_id",
        )
    return CondicionesComparacion.model_validate(json.loads(fila["condiciones_json"])), json.loads(fila["cambios_json"])


@router.post(
    "/comparaciones",
    response_model=RespuestaComparacion,
    summary="Ejecuta el stress test y devuelve las tres alternativas",
)
def crear_comparacion(condiciones: CondicionesComparacion) -> RespuestaComparacion:
    return correr_comparacion(condiciones)


@router.get(
    "/comparaciones/{comparacion_id}",
    response_model=RespuestaComparacion,
    summary="Estado o resultado de una comparacion",
)
def leer_comparacion(comparacion_id: str) -> RespuestaComparacion:
    return _recuperar(comparacion_id)


@router.get(
    "/comparaciones/{comparacion_id}/alternativas/{alternativa_id}/pasaporte",
    response_model=Pasaporte,
    summary="Pasaporte de campania de una alternativa",
)
def pasaporte(comparacion_id: str, alternativa_id: str) -> Pasaporte:
    comparacion = _recuperar(comparacion_id)
    alternativa = next((a for a in comparacion.alternativas if a.alternativa_id == alternativa_id), None)
    if alternativa is None:
        raise ErrorFieldShift(
            CodigoError.NO_ENCONTRADO,
            f"alternativa {alternativa_id} no esta en {comparacion_id}",
            campo="alternativa_id",
        )

    parcela = REPO.parcela(comparacion.parcela_id) or {"area_ha": 0.0, "localidad": "sin localidad"}
    mejor_margen = max((a.economia.margen_soles_ha_mediana for a in comparacion.alternativas), default=None)
    plan = comparacion.plan_habitual

    return Pasaporte(
        comparacion_id=comparacion_id,
        alternativa_id=alternativa_id,
        parcela=ParcelaResumen(area_ha=parcela["area_ha"], localidad=parcela["localidad"]),
        secuencia=alternativa.secuencia,
        metricas=Metricas(
            economia=alternativa.economia,
            agua=alternativa.agua,
            suelo=alternativa.suelo,
            riesgo=alternativa.riesgo,
            calidad_informacion=alternativa.calidad_informacion,
        ),
        explicacion=redactar(alternativa, mejor_margen),
        comparacion_con_plan_habitual=ComparacionConPlanHabitual(
            margen_delta_soles_ha=(
                round(alternativa.economia.margen_soles_ha_mediana - plan.margen_soles_ha_mediana, 0)
                if plan.evaluado and plan.margen_soles_ha_mediana is not None
                else None
            ),
            deficit_delta_mm=(
                round(alternativa.agua.deficit_mm_mediana - plan.deficit_mm_mediana, 0)
                if plan.evaluado and plan.deficit_mm_mediana is not None
                else None
            ),
        ),
        exportable=Exportable(
            pdf_url=f"/api/v1/comparaciones/{comparacion_id}/pasaporte.pdf?alt={alternativa_id}"
        ),
    )


@router.post(
    "/comparaciones/{comparacion_id}/cambios",
    response_model=RespuestaComparacion,
    summary="Aplica un cambio estructurado y devuelve la comparacion derivada",
)
def aplicar_cambio(comparacion_id: str, cambio: CambioCrear) -> RespuestaComparacion:
    anterior = _recuperar(comparacion_id)
    condiciones, cambios_previos = _condiciones_de(comparacion_id)

    parametros = cambios_mod.validar_parametros(cambio.intent, cambio.parametros, set(REPO.fichas))
    nuevas = cambios_mod.aplicar(condiciones.model_dump(mode="json"), cambio.intent, parametros)

    cambio_aplicado = CambioAplicado(
        cambio_id=nuevo_id("cambio"),
        intent=cambio.intent.value,
        etiqueta=cambios_mod.etiqueta_de(cambio.intent, parametros),
        origen=cambio.origen,
        parametros=parametros,
    )
    cambios = cambios_previos + [cambio_aplicado.model_dump(mode="json")]

    derivada = correr_comparacion(
        CondicionesComparacion.model_validate(nuevas),
        cambios=cambios,
        derivada_de=comparacion_id,
    )
    derivada.resumen_del_cambio = resumen_del_cambio(anterior, derivada)
    REPO.guardar_respuesta(derivada.comparacion_id, derivada.model_dump(mode="json"))
    return derivada


@router.delete(
    "/comparaciones/{comparacion_id}/cambios/{cambio_id}",
    response_model=RespuestaComparacion,
    summary="Deshace el ultimo cambio devolviendo la comparacion anterior",
)
def deshacer_cambio(comparacion_id: str, cambio_id: str) -> RespuestaComparacion:
    actual = _recuperar(comparacion_id)
    if not actual.escenarios_aplicados or actual.escenarios_aplicados[-1].cambio_id != cambio_id:
        raise ErrorFieldShift(
            CodigoError.NO_ENCONTRADO,
            f"{cambio_id} no es el ultimo cambio de {comparacion_id}",
            campo="cambio_id",
            mensaje_agricultor="Ese cambio ya no se puede deshacer. Quita la etiqueta mas reciente primero.",
        )
    if actual.derivada_de is None:
        raise ErrorFieldShift(
            CodigoError.NO_ENCONTRADO,
            f"{comparacion_id} no es una derivada",
            campo="comparacion_id",
        )
    # Deshacer es volver al identificador previo, no recalcular.
    return _recuperar(actual.derivada_de)


@router.get(
    "/comparaciones/{comparacion_id}/datos-y-supuestos",
    response_model=DatosYSupuestos,
    summary="Fuentes, fechas, versiones, supuestos y limitaciones de esa ejecucion",
)
def datos_y_supuestos(comparacion_id: str) -> DatosYSupuestos:
    comparacion = _recuperar(comparacion_id)
    parcela = REPO.parcela(comparacion.parcela_id)
    celda_id = parcela["celda_id"] if parcela else None
    datasets = REPO.datasets_de(celda_id) if celda_id else None

    fuentes = []
    if datasets is not None:
        fuentes = [
            {"dato": "clima diario", "fuente": REPO.fuente_clima(celda_id), "celda": celda_id},
            {
                "dato": "suelo",
                "fuente": datasets.suelo.fuente,
                "incertidumbre": datasets.suelo.incertidumbre,
                "provisional": datasets.suelo.provisional,
            },
        ] + [
            {"dato": f"ficha {clave}", "fuente": f.fuente, "provisional": f.provisional}
            for clave, f in sorted(REPO.fichas.items())
        ]

    faltantes = sorted({f for a in comparacion.alternativas for f in a.calidad_informacion.faltantes})
    return DatosYSupuestos(
        comparacion_id=comparacion_id,
        fuentes=fuentes,
        versiones={
            "motor": comparacion.motor.version,
            "contrato": VERSION_MOTOR,
            "datasets": comparacion.motor.version_datasets,
            "semilla": comparacion.motor.semilla,
            "fuente_resultado": comparacion.motor.fuente_resultado,
        },
        supuestos=SUPUESTOS,
        limitaciones=LIMITACIONES + ([f"Datos faltantes en esta ejecucion: {', '.join(faltantes)}."] if faltantes else []),
        generado_en=comparacion.generado_en.isoformat(),
    )
