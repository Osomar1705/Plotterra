"""Pregunta del agricultor -> cambio estructurado.

La llamada al modelo es el bloque compartido del dia 6. Lo que ya esta aqui es
la red de seguridad: un interprete por reglas que cubre los tres intents
obligatorios de la demo. Si el LLM no esta disponible, /consultas sigue
respondiendo y los botones de la pantalla no pasan por aqui en absoluto.

Barrera del diseno: la salida se valida siempre contra el esquema. El modelo
nunca produce una cifra de resultado, solo parametros de un cambio.
"""
from __future__ import annotations

import re
import unicodedata

from app.config import CONFIG
from app.schemas.consultas import Intent, Interpretacion

SUGERENCIAS = [
    "y si tengo 30 % menos riego?",
    "no puedo vender cebada",
    "quiero papa en la primera campania",
]

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


def interpretar_por_reglas(texto: str, catalogo: set[str]) -> Interpretacion | None:
    """Cubre los tres intents obligatorios mas cambiar_prioridad."""
    t = _normalizar(texto)

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


def interpretar_por_llm(texto: str, catalogo: set[str]) -> Interpretacion | None:
    """Pendiente: bloque compartido del dia 6.

    Reglas de operacion acordadas: temperatura 0, salida obligada al esquema
    Interpretacion, tiempo maximo de ocho segundos. Ante cualquier fallo se cae
    al interprete por reglas; nunca se deja al agricultor sin salida.
    """
    if not CONFIG.anthropic_api_key:
        return None
    return None


def interpretar(texto: str, catalogo: set[str]) -> tuple[Interpretacion | None, str]:
    """Devuelve (interpretacion, quien_la_hizo)."""
    try:
        por_llm = interpretar_por_llm(texto, catalogo)
    except Exception:  # noqa: BLE001 - el fallo del LLM nunca tumba el endpoint
        por_llm = None
    if por_llm is not None:
        return por_llm, "llm"
    return interpretar_por_reglas(texto, catalogo), "reglas"
