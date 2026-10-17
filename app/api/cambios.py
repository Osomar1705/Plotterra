"""Aplica un cambio estructurado a las condiciones. Responsable: Osmar.

Regla del contrato: un cambio nunca modifica una comparacion existente. Crea una
derivada y conserva la anterior, asi que "Deshacer" es volver al identificador
previo y no recalcular.

La misma modificacion hecha por chat o por el control de la pantalla llega a
este modulo con los mismos parametros y produce el mismo resultado. Eso es lo
que verifica el requisito del documento de frontend.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.api.errors import ErrorFieldShift
from app.schemas.comun import Prioridad
from app.schemas.consultas import Intent
from app.schemas.errores import CodigoError

ETIQUETAS = {
    Intent.ajustar_riego: "riego {signo}{pct} %",
    Intent.excluir_cultivo: "sin {cultivo}",
    Intent.fijar_cultivo_campania: "{cultivo} en campania {campania}",
    Intent.cambiar_prioridad: "prioridad {prioridad}",
}


def etiqueta_de(intent: Intent, parametros: dict[str, Any]) -> str:
    if intent is Intent.ajustar_riego:
        factor = float(parametros["factor"])
        pct = round(abs(1 - factor) * 100)
        return ETIQUETAS[intent].format(signo="-" if factor < 1 else "+", pct=pct)
    if intent is Intent.excluir_cultivo:
        return ETIQUETAS[intent].format(cultivo=parametros["cultivo"])
    if intent is Intent.fijar_cultivo_campania:
        return ETIQUETAS[intent].format(cultivo=parametros["cultivo"], campania=parametros["campania"])
    if intent is Intent.cambiar_prioridad:
        return ETIQUETAS[intent].format(prioridad=parametros["prioridad"])
    return "explicacion"


def validar_parametros(intent: Intent, parametros: dict[str, Any], catalogo: set[str]) -> dict[str, Any]:
    """Valida los parametros del intent antes de disparar un recalculo."""
    p = dict(parametros)
    if intent is Intent.ajustar_riego:
        try:
            factor = float(p["factor"])
        except (KeyError, TypeError, ValueError):
            raise ErrorFieldShift(
                CodigoError.ENTRADA_INVALIDA,
                "ajustar_riego necesita un factor numerico",
                campo="parametros.factor",
                mensaje_agricultor="No entendimos cuanto riego cambiar. Prueba con el control de riego.",
            ) from None
        if not (0.1 <= factor <= 1.5):
            raise ErrorFieldShift(
                CodigoError.AGUA_INVALIDA,
                f"factor {factor} fuera del rango 0.1-1.5",
                campo="parametros.factor",
                mensaje_agricultor="Ese cambio de riego queda fuera de lo que podemos simular.",
            )
        p["factor"] = factor
    elif intent is Intent.excluir_cultivo:
        if p.get("cultivo") not in catalogo:
            raise ErrorFieldShift(
                CodigoError.CULTIVOS_INSUFICIENTES,
                f"cultivo {p.get('cultivo')} fuera del catalogo",
                campo="parametros.cultivo",
            )
        p.setdefault("motivo", "sin_motivo_declarado")
    elif intent is Intent.fijar_cultivo_campania:
        if p.get("cultivo") not in catalogo:
            raise ErrorFieldShift(
                CodigoError.CULTIVOS_INSUFICIENTES,
                f"cultivo {p.get('cultivo')} fuera del catalogo",
                campo="parametros.cultivo",
            )
        campania = p.get("campania")
        if campania not in (1, 2, 3):
            raise ErrorFieldShift(
                CodigoError.ENTRADA_INVALIDA,
                f"campania {campania} debe ser 1, 2 o 3",
                campo="parametros.campania",
                mensaje_agricultor="Dinos en que campania quieres ese cultivo: la primera, la segunda o la tercera.",
            )
    elif intent is Intent.cambiar_prioridad:
        if p.get("prioridad") not in {x.value for x in Prioridad}:
            raise ErrorFieldShift(
                CodigoError.PRIORIDAD_INVALIDA,
                f"prioridad {p.get('prioridad')} invalida",
                campo="parametros.prioridad",
            )
    return p


def aplicar(condiciones: dict[str, Any], intent: Intent, parametros: dict[str, Any]) -> dict[str, Any]:
    """Devuelve unas condiciones nuevas. No muta las que recibe."""
    nuevas = deepcopy(condiciones)

    if intent is Intent.ajustar_riego:
        actual = nuevas.get("agua", {}).get("lamina_mm_campania") or 0.0
        nuevas["agua"]["lamina_mm_campania"] = round(actual * float(parametros["factor"]), 1)
        if nuevas["agua"]["lamina_mm_campania"] <= 0:
            nuevas["agua"]["modo"] = "secano"
            nuevas["agua"]["lamina_mm_campania"] = None

    elif intent is Intent.excluir_cultivo:
        cultivo = parametros["cultivo"]
        excluidos = nuevas.setdefault("cultivos_excluidos", [])
        if cultivo not in {e["cultivo"] for e in excluidos}:
            excluidos.append({"cultivo": cultivo, "motivo": parametros.get("motivo", "sin_motivo_declarado")})

    elif intent is Intent.fijar_cultivo_campania:
        # El motor no recibe una secuencia fija: recibe el cultivo como unico
        # candidato de esa campania. Se anota aparte para que las rotaciones lo
        # respeten sin cambiar la forma de las condiciones.
        fijos = nuevas.setdefault("cultivos_fijados", {})
        fijos[str(parametros["campania"])] = parametros["cultivo"]

    elif intent is Intent.cambiar_prioridad:
        nuevas["prioridad"] = parametros["prioridad"]

    return nuevas
