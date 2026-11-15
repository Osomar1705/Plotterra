"""Pregunta del agricultor -> cambio estructurado.

La llamada al modelo es el bloque compartido del dia 6. Lo que ya esta aqui es
la red de seguridad: un interprete por reglas que cubre los tres intents
obligatorios de la demo. Si el LLM no esta disponible, /consultas sigue
respondiendo y los botones de la pantalla no pasan por aqui en absoluto.

Barrera del diseno: la salida se valida siempre contra el esquema. El modelo
nunca produce una cifra de resultado, solo parametros de un cambio.
"""
from __future__ import annotations

import logging
import re
import unicodedata

from pydantic import BaseModel

from app.config import CONFIG
from app.schemas.consultas import Intent, Interpretacion

log = logging.getLogger("fieldshift")

SUGERENCIAS = [
    "y si tengo 30 % menos riego?",
    "no puedo vender cebada",
    "quiero papa en la primera campania",
]
SUGERENCIAS_EN = [
    "What if I have 30% less irrigation?",
    "I can't sell barley",
    "I want potato in the first season",
]

# El frontend de la v9 esta en ingles. Sin clave de LLM las consultas las
# resuelve este interprete por reglas: se traducen las palabras clave al espanol
# antes de aplicar las mismas reglas, y la descripcion vuelve en ingles.
_CULTIVOS_EN = {
    "potatoes": "papa", "potato": "papa", "quinoa": "quinua", "barley": "cebada",
    "oats": "avena", "oat": "avena", "fava beans": "haba", "fava bean": "haba", "fava": "haba",
    "broad beans": "haba", "broad bean": "haba", "beans": "haba", "lupin": "tarwi", "tarwi": "tarwi",
}
_NOMBRE_EN = {"papa": "potato", "quinua": "quinoa", "cebada": "barley", "avena": "oats", "haba": "fava bean", "tarwi": "tarwi"}
_PRIORIDAD_EN = {"agua": "water", "suelo": "soil", "economia": "income"}
_INGLES = [
    (r"\bcan ?not sell\b|\bcan'?t sell\b|\bno buyer\b", "no puedo vender"),
    (r"\bi don'?t want\b|\bi do not want\b", "no quiero"),
    (r"\bwithout irrigation\b|\bno irrigation\b", "sin riego"),
    (r"\bwithout\b|\bexclude\b|\bremove\b", "sin"),
    (r"\bstart with\b|\bbegin with\b", "quiero inicio"),
    (r"\bi want\b|\bi need\b|\bput\b", "quiero"),
    (r"\bprefer\b|\bprioriti[sz]e\b|\bcare (more )?about\b|\bfocus on\b", "prefiero"),
    (r"\birrigation\b|\birrigate\b|\bwatering\b", "riego"),
    (r"\bwater\b", "agua"),
    (r"\brainfall\b|\brains?\b|\braining\b", "lluvia"),
    (r"\bdrought\b|\bdry year\b", "sequia"),
    (r"\bselling prices?\b|\bprices?\b", "precio"),
    (r"\bless\b|\blower\b|\bfewer\b|\bdrops?\b|\bfalls?\b|\bcuts?\b|\breduced?\b", "menos"),
    (r"\bmore\b|\bhigher\b|\bincreases?d?\b|\brises?\b", "mas"),
    (r"\bhalf\b", "mitad"),
    (r"\bdouble\b", "doble"),
    (r"\bfirst\b", "primera"), (r"\bsecond\b", "segunda"), (r"\bthird\b|\blast\b", "tercera"),
    (r"\bsoil\b|\bland\b", "suelo"),
    (r"\bmoney\b|\bincome\b|\bprofit\b|\bearnings?\b", "dinero"),
]
_SENAL_INGLES = re.compile(
    r"\b(what|if|less|more|irrigation|rain|price|prices|without|want|potato|quinoa|barley|oats|"
    r"bean|beans|fava|start|with|season|the|my|can'?t|have|lower|drop|drought|prefer|soil|water|"
    r"hello|hi|help|how|why|which|safer|plan|show|explain)\b"
)


def es_ingles(texto: str) -> bool:
    """Heuristica simple: la pregunta trae palabras en ingles y ninguna tilde ni enie."""
    t = texto.lower()
    return bool(_SENAL_INGLES.search(t)) and not re.search(r"[áéíóúñ¿¡]", t)


def _traducir(texto: str) -> str:
    t = texto.lower()
    for en, es in sorted(_CULTIVOS_EN.items(), key=lambda kv: -len(kv[0])):
        t = re.sub(rf"\b{en}\b", es, t)
    for patron, es in _INGLES:
        t = re.sub(patron, es, t)
    return t


def _descripcion_en(i: Interpretacion) -> str:
    p = i.parametros
    if "factor" in p:
        pct = round(abs(1 - float(p["factor"])) * 100)
        menos = float(p["factor"]) < 1
        que = {Intent.ajustar_riego: "available irrigation", Intent.ajustar_lluvia: "rainfall",
               Intent.ajustar_precio: "selling prices"}.get(i.intent, "it")
        return f"{'Cut' if menos else 'Raise'} {que} by {pct}% and compare again"
    if i.intent is Intent.excluir_cultivo:
        return f"Remove {_NOMBRE_EN.get(p['cultivo'], p['cultivo'])} from the crops and compare again"
    if i.intent is Intent.fijar_cultivo_campania:
        return f"Put {_NOMBRE_EN.get(p['cultivo'], p['cultivo'])} in season {p['campania']} and compare again"
    if i.intent is Intent.cambiar_prioridad:
        return f"Compare again with {_PRIORIDAD_EN.get(p['prioridad'], p['prioridad'])} as the priority"
    return i.descripcion

_PRIORIDADES = {
    "agua": "agua",
    "riego": "agua",
    "suelo": "suelo",
    "tierra": "suelo",
    "plata": "economia",
    "dinero": "economia",
    "economia": "economia",
    "ganancia": "economia",
}
_ORDINALES = {
    "primera": 1, "primer": 1, "inicio": 1, "comienzo": 1, "1": 1,
    "segunda": 2, "segundo": 2, "medio": 2, "2": 2,
    "tercera": 3, "tercer": 3, "final": 3, "ultima": 3, "3": 3,
}


def _normalizar(texto: str) -> str:
    sin_tildes = "".join(c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", sin_tildes).strip()


def _factor_de(t: str) -> float | None:
    """Saca el factor de frases como "30 % menos", "la mitad", "el doble"."""
    sube = any(p in t for p in ("mas", "aumenta", "sube", "subir", "doble", "mejor"))
    pct = re.search(r"(\d{1,3})\s*%", t)
    if pct:
        valor = int(pct.group(1)) / 100
        factor = round(1 + valor, 2) if sube else round(1 - valor, 2)
        return factor if 0.1 <= factor <= 2.0 else None
    if "mitad" in t:
        return 0.5
    if "doble" in t:
        return 2.0
    if any(p in t for p in ("menos", "baja", "bajara", "cae", "caiga", "poca", "poco")):
        return 0.7  # sin cifra: un recorte moderado, y la pantalla pide confirmacion
    return None


def interpretar_por_reglas(texto: str, catalogo: set[str]) -> Interpretacion | None:
    """Acepta espanol o ingles; en ingles la descripcion vuelve en ingles."""
    if es_ingles(texto):
        resultado = _interpretar_es(_traducir(texto), catalogo)
        if resultado is not None:
            resultado = resultado.model_copy(update={"descripcion": _descripcion_en(resultado)})
        return resultado
    return _interpretar_es(texto, catalogo)


def _interpretar_es(texto: str, catalogo: set[str]) -> Interpretacion | None:
    """Cubre los tres intents obligatorios mas cambiar_prioridad."""
    t = _normalizar(texto)

    # ajustar_lluvia y ajustar_precio van primero: "y si llueve menos" habla de
    # agua, y caeria en ajustar_riego si se evaluara despues.
    for intent, palabras in (
        (Intent.ajustar_lluvia, ("llueve", "lluvia", "lloviera", "llover", "seco", "sequia")),
        (Intent.ajustar_precio, ("precio", "precios", "pagan", "vale", "cotiza", "baja el valor")),
    ):
        if any(p in t for p in palabras):
            factor = _factor_de(t)
            # "ano seco" no trae cifra pero si direccion: se asume un recorte
            # moderado y la pantalla pide confirmacion antes de recalcular.
            if factor is None and any(p in t for p in ("seco", "sequia")):
                factor = 0.7
            if factor is not None:
                from app.api.cambios import etiqueta_de

                nombre = "la lluvia" if intent is Intent.ajustar_lluvia else "el precio"
                parametros = {"factor": factor}
                return Interpretacion(
                    intent=intent,
                    parametros=parametros,
                    descripcion=(
                        f"{'Reducir' if factor < 1 else 'Aumentar'} {nombre} "
                        f"un {round(abs(1 - factor) * 100)} % y volver a comparar"
                    ),
                    etiqueta=etiqueta_de(intent, parametros),
                    confianza=0.84,
                )

    # ajustar_riego: "30% menos riego", "la mitad de agua", "sin riego"
    if any(p in t for p in ("riego", "agua", "regar")):
        pct = re.search(r"(\d{1,3})\s*%", t)
        if pct:
            valor = int(pct.group(1)) / 100
            sube = any(p in t for p in ("mas", "aumenta", "subo", "subir", "doble"))
            factor = round(1 + valor, 2) if sube else round(1 - valor, 2)
            if 0.1 <= factor <= 1.5:
                from app.api.cambios import etiqueta_de

                parametros = {"factor": factor}
                return Interpretacion(
                    intent=Intent.ajustar_riego,
                    parametros=parametros,
                    descripcion=(
                        f"{'Aumentar' if sube else 'Reducir'} el riego disponible un {pct.group(1)} % y volver a comparar"
                    ),
                    etiqueta=etiqueta_de(Intent.ajustar_riego, parametros),
                    confianza=0.88,
                )
        if "mitad" in t:
            from app.api.cambios import etiqueta_de

            parametros = {"factor": 0.5}
            return Interpretacion(
                intent=Intent.ajustar_riego,
                parametros=parametros,
                descripcion="Reducir el riego disponible a la mitad y volver a comparar",
                etiqueta=etiqueta_de(Intent.ajustar_riego, parametros),
                confianza=0.80,
            )
        if any(p in t for p in ("sin riego", "no tengo riego", "nada de riego", "se corto")):
            from app.api.cambios import etiqueta_de

            parametros = {"factor": 0.1}
            return Interpretacion(
                intent=Intent.ajustar_riego,
                parametros=parametros,
                descripcion="Simular la campania practicamente sin riego y volver a comparar",
                etiqueta=etiqueta_de(Intent.ajustar_riego, parametros),
                confianza=0.72,
            )

    # excluir_cultivo: "no puedo vender cebada", "sin papa"
    if any(p in t for p in ("no puedo vender", "no vendo", "sin comprador", "sin ", "no quiero", "saca")):
        for cultivo in catalogo:
            if cultivo in t:
                from app.api.cambios import etiqueta_de

                motivo = "sin_comprador" if "vend" in t or "comprador" in t else "decision_del_agricultor"
                parametros = {"cultivo": cultivo, "motivo": motivo}
                return Interpretacion(
                    intent=Intent.excluir_cultivo,
                    parametros=parametros,
                    descripcion=f"Quitar {cultivo} de los cultivos a evaluar y volver a comparar",
                    etiqueta=etiqueta_de(Intent.excluir_cultivo, parametros),
                    confianza=0.85,
                )

    # fijar_cultivo_campania: "quiero papa al inicio"
    if any(p in t for p in ("quiero", "necesito", "tiene que ir", "poner")):
        for cultivo in catalogo:
            if cultivo in t:
                campania = next((n for palabra, n in _ORDINALES.items() if palabra in t), 1)
                from app.api.cambios import etiqueta_de

                parametros = {"cultivo": cultivo, "campania": campania}
                return Interpretacion(
                    intent=Intent.fijar_cultivo_campania,
                    parametros=parametros,
                    descripcion=f"Fijar {cultivo} en la campania {campania} y volver a comparar",
                    etiqueta=etiqueta_de(Intent.fijar_cultivo_campania, parametros),
                    confianza=0.78,
                )

    # cambiar_prioridad: "prefiero cuidar el agua"
    if any(p in t for p in ("prefiero", "me importa", "priorizo", "cuidar")):
        for palabra, prioridad in _PRIORIDADES.items():
            if palabra in t:
                from app.api.cambios import etiqueta_de

                parametros = {"prioridad": prioridad}
                return Interpretacion(
                    intent=Intent.cambiar_prioridad,
                    parametros=parametros,
                    descripcion=f"Comparar poniendo {prioridad} como prioridad",
                    etiqueta=etiqueta_de(Intent.cambiar_prioridad, parametros),
                    confianza=0.75,
                )

    return None


class _SalidaLLM(BaseModel):
    """Lo que se le permite devolver al modelo.

    No incluye `etiqueta`: esa la calcula etiqueta_de() con el mismo formato que
    usan los botones de la pantalla. Tampoco acepta cifras de resultado: solo
    parametros de un cambio, que validar_parametros() vuelve a comprobar.
    """

    intent: Intent
    factor: float | None = None
    cultivo: str | None = None
    campania: int | None = None
    prioridad: str | None = None
    descripcion: str
    confianza: float


_SISTEMA = """Interpretas lo que un agricultor peruano pregunta sobre su campania y lo conviertes en un cambio estructurado.

Intents y sus parametros:
- ajustar_riego: factor (0.1 a 1.5). "30 % menos riego" es 0.7; "el doble" es 1.5.
- excluir_cultivo: cultivo (uno del catalogo).
- fijar_cultivo_campania: cultivo (del catalogo) y campania (1, 2 o 3).
- cambiar_prioridad: prioridad (agua, suelo o economia).
- explicar: sin parametros.

Reglas:
- Usa solo cultivos del catalogo que se te da. Si menciona uno que no esta, elige explicar con confianza baja.
- descripcion: una linea en espanol llano, sin tecnicismos, diciendo que se va a recalcular.
- confianza: 0 a 1. Por debajo de 0.5 si la pregunta es ambigua.
- Nunca inventes rendimientos, precios ni margenes. Solo parametros del cambio."""


def interpretar_por_llm(texto: str, catalogo: set[str]) -> Interpretacion | None:
    """Interpreta con el modelo; None si no se pudo o si la salida no valida.

    Reglas de operacion acordadas: salida obligada al esquema Interpretacion y
    tiempo maximo de ocho segundos. Ante cualquier fallo se cae al interprete
    por reglas; nunca se deja al agricultor sin salida.

    Nota: el acuerdo original decia "temperatura 0". La API ya no acepta ese
    parametro: ahora se obtiene lo mismo obligando el esquema de salida.
    """
    if not CONFIG.anthropic_api_key:
        return None

    from app.api.cambios import etiqueta_de, validar_parametros
    from app.llm.cliente import responder

    salida = responder(
        sistema=_SISTEMA,
        mensaje=f"Catalogo de cultivos: {sorted(catalogo)}\n\nPregunta: {texto}",
        esquema=_SalidaLLM,
    )
    if salida is None:
        return None

    parametros: dict = {}
    if salida.intent is Intent.ajustar_riego and salida.factor is not None:
        parametros = {"factor": round(float(salida.factor), 2)}
    elif salida.intent is Intent.excluir_cultivo and salida.cultivo:
        parametros = {"cultivo": salida.cultivo, "motivo": "decision_del_agricultor"}
    elif salida.intent is Intent.fijar_cultivo_campania and salida.cultivo and salida.campania:
        parametros = {"cultivo": salida.cultivo, "campania": int(salida.campania)}
    elif salida.intent is Intent.cambiar_prioridad and salida.prioridad:
        parametros = {"prioridad": salida.prioridad}
    elif salida.intent is not Intent.explicar:
        return None  # dijo un intent pero no sus parametros

    # El modelo es una fuente no confiable: sus parametros pasan por el mismo
    # validador que los de la pantalla.
    try:
        parametros = validar_parametros(salida.intent, parametros, catalogo)
        etiqueta = etiqueta_de(salida.intent, parametros)
    except Exception:  # noqa: BLE001 - ErrorFieldShift o KeyError: en ambos casos caemos a reglas
        log.info("el LLM devolvio parametros que no validan; se usan las reglas")
        return None

    return Interpretacion(
        intent=salida.intent,
        parametros=parametros,
        descripcion=salida.descripcion.strip(),
        etiqueta=etiqueta,
        confianza=max(0.0, min(1.0, float(salida.confianza))),
    )


def interpretar(texto: str, catalogo: set[str]) -> tuple[Interpretacion | None, str]:
    """Devuelve (interpretacion, quien_la_hizo)."""
    try:
        por_llm = interpretar_por_llm(texto, catalogo)
    except Exception:  # noqa: BLE001 - el fallo del LLM nunca tumba el endpoint
        por_llm = None
    if por_llm is not None:
        return por_llm, "llm"
    return interpretar_por_reglas(texto, catalogo), "reglas"
