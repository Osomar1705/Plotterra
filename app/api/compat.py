"""Traduce lo que el frontend manda hoy al contrato canonico.

El frontend ya normaliza nuestras respuestas aceptando espanol e ingles; esto
hace lo simetrico con sus peticiones. Asi ninguno de los dos equipos tiene que
reescribir su cliente a dos dias de la entrega.

Regla: el contrato canonico no cambia. Esto solo acepta alias de entrada.
"""
from __future__ import annotations

from typing import Any

# El frontend nombra los modos de agua en ingles.
MODOS_AGUA = {
    "rainfed": "secano",
    "scheduled": "riego_turnos",
    "irrigated": "riego_continuo",
}

# Tipos de cambio del frontend -> intents del backend.
INTENTS = {
    "irrigation": "ajustar_riego",
    "riego": "ajustar_riego",
    "exclude_crop": "excluir_cultivo",
    "exclusion": "excluir_cultivo",
    "fix_crop": "fijar_cultivo_campania",
    "set_crop": "fijar_cultivo_campania",
    "priority": "cambiar_prioridad",
    "explain": "explicar",
}

PRIORIDADES = {
    "economy": "economia",
    "water": "agua",
    "soil": "suelo",
}

# camelCase ingles -> campo canonico de CondicionesComparacion.
CONDICIONES = {
    "plotId": "parcela_id",
    "plot_id": "parcela_id",
    "startDate": "fecha_inicio",
    "start_date": "fecha_inicio",
    "previousCrop": "cultivo_anterior",
    "previous_crop": "cultivo_anterior",
    "allowedCrops": "cultivos_permitidos",
    "allowed_crops": "cultivos_permitidos",
    "priority": "prioridad",
    "horizon": "horizonte_campanias",
    "excludedCrops": "cultivos_excluidos",
    "usualPlan": "plan_habitual",
}


def solo_campos_conocidos(modelo, d: dict[str, Any]) -> dict[str, Any]:
    """Descarta lo que el modelo no declara.

    El frontend manda campos suyos (dataQualityHint, etiquetas de UI) que no son
    parte del contrato. Rechazar la peticion entera por eso seria fragil: cada
    campo nuevo de su lado romperia el backend. Se ignoran y se sigue.
    """
    conocidos = set(modelo.model_fields)
    return {k: v for k, v in d.items() if k in conocidos}


def normalizar_condiciones(cuerpo: dict[str, Any]) -> dict[str, Any]:
    """Acepta el objeto del frontend y devuelve el canonico."""
    d = dict(cuerpo)

    for ajeno, propio in CONDICIONES.items():
        if ajeno in d and propio not in d:
            d[propio] = d.pop(ajeno)

    # agua llega plana (waterMode + irrigationMm) o ya anidada.
    if "agua" not in d:
        modo = d.pop("waterMode", None) or d.pop("water_mode", None) or d.pop("modo_agua", None)
        lamina = d.pop("irrigationMm", None) or d.pop("irrigation_mm", None)
        if modo is not None or lamina is not None:
            agua: dict[str, Any] = {"modo": MODOS_AGUA.get(str(modo), modo or "secano")}
            if lamina is not None:
                agua["lamina_mm_campania"] = lamina
            d["agua"] = agua
    elif isinstance(d.get("agua"), dict):
        modo = d["agua"].get("modo")
        if modo in MODOS_AGUA:
            d["agua"] = {**d["agua"], "modo": MODOS_AGUA[modo]}

    # escenarios llega como seed suelta.
    semilla = d.pop("seed", None)
    n = d.pop("scenarios", None)
    if (semilla is not None or n is not None) and "escenarios" not in d:
        esc: dict[str, Any] = {}
        if semilla is not None:
            esc["semilla"] = semilla
        if n is not None:
            esc["n"] = n
        d["escenarios"] = esc

    if d.get("prioridad") in PRIORIDADES:
        d["prioridad"] = PRIORIDADES[d["prioridad"]]

    # areaHa no viaja: el area la manda la parcela ya registrada.
    for sobra in ("areaHa", "area_ha"):
        d.pop(sobra, None)

    return d


def normalizar_consulta(cuerpo: dict[str, Any]) -> dict[str, Any]:
    """{comparison_id, consulta} -> {comparacion_id, texto}."""
    d = dict(cuerpo)
    if "comparacion_id" not in d:
        for alias in ("comparison_id", "comparisonId"):
            if alias in d:
                d["comparacion_id"] = d.pop(alias)
                break
    if "texto" not in d:
        for alias in ("consulta", "message", "mensaje", "text"):
            if alias in d:
                d["texto"] = d.pop(alias)
                break
    return d


def normalizar_cambio(cuerpo: dict[str, Any]) -> dict[str, Any]:
    """Acepta {cambio: {...}} envuelto y los nombres en ingles del cambio."""
    d = dict(cuerpo)
    interno = d.get("cambio") or d.get("change")
    if isinstance(interno, dict):
        d = dict(interno)

    if "intent" not in d:
        for alias in ("type", "tipo", "intencion"):
            if alias in d:
                d["intent"] = d.pop(alias)
                break

    if "parametros" not in d:
        # El frontend manda {operation, value, unit} para el riego.
        operacion = d.pop("operation", None) or d.pop("operacion", None)
        valor = d.pop("value", None)
        if valor is None:
            valor = d.pop("valor", None)
        unidad = d.pop("unit", None) or d.pop("unidad", None)
        if valor is not None:
            v = float(valor)
            if unidad in ("percent", "porcentaje", "%"):
                v = v / 100
            if operacion in ("reduce", "reducir", "bajar"):
                d["parametros"] = {"factor": round(1 - v, 2)}
            elif operacion in ("increase", "aumentar", "subir"):
                d["parametros"] = {"factor": round(1 + v, 2)}
            else:
                d["parametros"] = {"factor": round(v, 2)}

    if d.get("intent") in INTENTS:
        d["intent"] = INTENTS[d["intent"]]

    d.pop("id", None)
    d.pop("label", None)
    d.pop("etiqueta", None)
    return d


def validar(modelo, cuerpo: dict):
    """Valida el cuerpo ya normalizado conservando nuestro cuerpo de error.

    Al aceptar `dict` en la ruta perdemos el 422 que FastAPI arma solo, asi que
    lo reponemos aqui: un campo mal puesto sigue saliendo con codigo, campo y
    mensaje_agricultor, como el resto de los errores.
    """
    from pydantic import ValidationError

    from app.api.errors import ErrorFieldShift
    from app.schemas.errores import CodigoError

    try:
        return modelo.model_validate(solo_campos_conocidos(modelo, cuerpo))
    except ValidationError as exc:
        primero = exc.errors()[0]
        campo = ".".join(str(x) for x in primero.get("loc", ())) or None
        raise ErrorFieldShift(
            CodigoError.ENTRADA_INVALIDA,
            f"{campo}: {primero.get('msg', 'valor invalido')}",
            campo=campo,
            mensaje_agricultor="Revisa los datos que enviaste: hay un campo con un valor que no entendemos.",
        ) from exc
