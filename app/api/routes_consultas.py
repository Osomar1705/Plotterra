"""Interpreta una pregunta en lenguaje natural sin aplicarla todavia.

La consulta y la aplicacion estan separadas a proposito: el wireframe exige
mostrar la interpretacion antes de ejecutarla, y asi una interpretacion
equivocada no dispara un recalculo.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.api.errors import ErrorFieldShift
from app.data.repository import REPO
from app.llm.intent import SUGERENCIAS, interpretar
from app.schemas.consultas import ConsultaCrear, RespuestaConsulta
from app.schemas.errores import CodigoError

router = APIRouter(tags=["consultas"])


@router.post(
    "/consultas",
    response_model=RespuestaConsulta,
    summary="Interpreta una pregunta en lenguaje natural sin aplicarla",
)
def crear_consulta(consulta: ConsultaCrear) -> RespuestaConsulta:
    if REPO.respuesta(consulta.comparacion_id) is None:
        raise ErrorFieldShift(
            CodigoError.NO_ENCONTRADO,
            f"comparacion {consulta.comparacion_id} inexistente",
            campo="comparacion_id",
        )

    interpretacion, quien = interpretar(consulta.texto, set(REPO.fichas))
    if interpretacion is None:
        # CONSULTA_NO_ENTENDIDA va con 200: no es un error, y nunca se deja al
        # agricultor sin salida.
        return RespuestaConsulta(
            interpretacion=None,
            aplicable=False,
            requiere_confirmacion=False,
            interpretado_por=quien,
            sugerencias=SUGERENCIAS,
        )
    return RespuestaConsulta(
        interpretacion=interpretacion,
        aplicable=True,
        requiere_confirmacion=True,
        interpretado_por=quien,
    )
