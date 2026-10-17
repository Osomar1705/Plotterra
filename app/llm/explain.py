"""Cifras del motor -> texto.

Instruccion explicita del diseno: el modelo no puede introducir ningun numero
que no venga en la respuesta del motor. Mientras la llamada al LLM no exista, o
cuando falla, se devuelven textos de plantilla construidos con esas mismas
cifras y el pasaporte sigue siendo utilizable.
"""
from __future__ import annotations

from app.config import CONFIG
from app.schemas.comparacion import Alternativa
from app.schemas.pasaporte import Explicacion


def _plantilla(alternativa: Alternativa, mejor_margen: float | None) -> Explicacion:
    ag, ec, su = alternativa.agua, alternativa.economia, alternativa.suelo
    if alternativa.criterio.value == "agua":
        conviene = f"Mantiene el deficit en {ag.deficit_mm_mediana:.0f} mm de mediana, el mas bajo de las tres opciones"
    elif alternativa.criterio.value == "economia":
        conviene = f"Deja el margen mas alto de las tres: {ec.margen_soles_ha_mediana:.0f} soles por hectarea de mediana"
    else:
        conviene = f"Es la secuencia mas compatible con el suelo, con indice {su.indice:.2f}: {su.razon}"

    if mejor_margen is not None and mejor_margen > ec.margen_soles_ha_mediana:
        sacrifica = (
            f"Cerca de {mejor_margen - ec.margen_soles_ha_mediana:.0f} soles por hectarea "
            "frente a la alternativa de economia"
        )
    elif ag.deficit_mm_mediana > 0:
        sacrifica = f"Deja un deficit de {ag.deficit_mm_mediana:.0f} mm que habria que cubrir con riego"
    else:
        sacrifica = "No sacrifica margen frente a las otras dos alternativas evaluadas"

    faltante = alternativa.calidad_informacion.dato_critico
    dato = (
        f"La calidad de informacion es {alternativa.calidad_informacion.nivel.value}: falta {faltante.replace('_', ' ')}"
        if faltante
        else "Con los datos actuales no hay un faltante critico declarado"
    )
    return Explicacion(
        por_que_conviene=conviene,
        que_se_sacrifica=sacrifica,
        que_dato_cambiaria=dato,
        redactado_por="plantilla",
    )


def redactar_por_llm(alternativa: Alternativa, mejor_margen: float | None) -> Explicacion | None:
    """Pendiente: bloque compartido del dia 6. Temperatura 0, sin cifras nuevas."""
    if not CONFIG.anthropic_api_key:
        return None
    return None


def redactar(alternativa: Alternativa, mejor_margen: float | None = None) -> Explicacion:
    try:
        por_llm = redactar_por_llm(alternativa, mejor_margen)
    except Exception:  # noqa: BLE001 - si falla el LLM, el pasaporte sigue utilizable
        por_llm = None
    return por_llm or _plantilla(alternativa, mejor_margen)
