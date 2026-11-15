"""Cifras del motor -> texto.

Instruccion explicita del diseno: el modelo no puede introducir ningun numero
que no venga en la respuesta del motor. Mientras la llamada al LLM no exista, o
cuando falla, se devuelven textos de plantilla construidos con esas mismas
cifras y el pasaporte sigue siendo utilizable.
"""
from __future__ import annotations

from pydantic import BaseModel

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


class _TextosLLM(BaseModel):
    por_que_conviene: str
    que_se_sacrifica: str
    que_dato_cambiaria: str


_SISTEMA = """Explicas a un agricultor peruano por que una opcion de siembra le conviene, a partir de cifras ya calculadas.

Te dan las cifras. Tu trabajo es redactarlas, no recalcularlas.

Reglas, en orden de importancia:
1. No introduzcas ningun numero que no este en los datos que te doy. Ni redondeos nuevos, ni porcentajes derivados, ni estimaciones.
2. Espanol llano y directo, de tu a tu. Nada de "se recomienda" ni "el sistema estima".
3. Una o dos frases por campo. Son tres campos:
   - por_que_conviene: la ventaja principal de esta opcion.
   - que_se_sacrifica: que pierde al elegirla. Siempre hay algo; si no lo ves claro, di cual es el riesgo.
   - que_dato_cambiaria: que dato tendria que salir distinto para que esta deje de ser la mejor opcion.
4. No prometas resultados. Son proyecciones, no certezas."""


def redactar_por_llm(alternativa: Alternativa, mejor_margen: float | None) -> Explicacion | None:
    """Redacta con el modelo; None si no se pudo.

    Nota: el acuerdo decia "temperatura 0"; la API ya no acepta ese parametro.
    La barrera contra cifras inventadas es la regla 1 del sistema mas el hecho
    de que el modelo solo ve las cifras ya calculadas, nunca los datos crudos.
    """
    if not CONFIG.openai_api_key:
        return None

    from app.llm.cliente import responder

    ag, ec, su = alternativa.agua, alternativa.economia, alternativa.suelo
    secuencia = " despues ".join(p.cultivo for p in alternativa.secuencia)
    datos = [
        f"Secuencia de cultivos: {secuencia}",
        f"Criterio por el que destaca: {alternativa.criterio.value}",
        f"Deficit de agua (mediana): {ag.deficit_mm_mediana:.0f} mm",
        f"Margen (mediana): {ec.margen_soles_ha_mediana:.0f} soles por hectarea",
        f"Indice de suelo: {su.indice:.2f} sobre 1",
    ]
    if su.razon:
        datos.append(f"Razon del indice de suelo: {su.razon}")
    if mejor_margen is not None:
        datos.append(f"Margen de la opcion mas rentable de las tres: {mejor_margen:.0f} soles por hectarea")

    textos = responder(
        sistema=_SISTEMA,
        mensaje="Cifras de esta opcion:\n" + "\n".join(f"- {d}" for d in datos),
        esquema=_TextosLLM,
    )
    if textos is None:
        return None
    return Explicacion(
        por_que_conviene=textos.por_que_conviene.strip(),
        que_se_sacrifica=textos.que_se_sacrifica.strip(),
        que_dato_cambiaria=textos.que_dato_cambiaria.strip(),
        redactado_por="llm",
    )


def redactar(alternativa: Alternativa, mejor_margen: float | None = None) -> Explicacion:
    try:
        por_llm = redactar_por_llm(alternativa, mejor_margen)
    except Exception:  # noqa: BLE001 - si falla el LLM, el pasaporte sigue utilizable
        por_llm = None
    return por_llm or _plantilla(alternativa, mejor_margen)
