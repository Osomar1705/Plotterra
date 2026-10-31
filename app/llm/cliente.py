"""Cliente de Anthropic compartido por intent.py y explain.py.

Se construye una sola vez y solo si hay clave. Cualquier fallo aqui devuelve
None: los dos llamadores tienen su propia salida sin LLM, asi que una API caida
nunca tumba un endpoint.
"""
from __future__ import annotations

import logging
from typing import Any, TypeVar

from pydantic import BaseModel

from app.config import CONFIG

log = logging.getLogger("fieldshift")

T = TypeVar("T", bound=BaseModel)

_cliente: Any | None = None
_intentado = False


def _obtener_cliente() -> Any | None:
    global _cliente, _intentado
    if _intentado:
        return _cliente
    _intentado = True
    if not CONFIG.anthropic_api_key:
        return None
    try:
        import anthropic
    except ImportError:
        log.warning("anthropic no instalado: el chatbot cae a reglas y plantillas")
        return None
    # Sin reintentos: el presupuesto es de 8 s y ambos llamadores tienen una
    # salida deterministica. Un reintento se lo comeria entero.
    _cliente = anthropic.Anthropic(
        api_key=CONFIG.anthropic_api_key,
        timeout=CONFIG.presupuesto_ms / 1000,
        max_retries=0,
    )
    return _cliente


def responder(
    *,
    sistema: str,
    mensaje: str,
    esquema: type[T],
    max_tokens: int = 1024,
) -> T | None:
    """Pide una respuesta que cumpla `esquema`. None si no se pudo."""
    cliente = _obtener_cliente()
    if cliente is None:
        return None
    try:
        respuesta = cliente.messages.parse(
            model=CONFIG.modelo_llm,
            max_tokens=max_tokens,
            system=sistema,
            messages=[{"role": "user", "content": mensaje}],
            output_config={"effort": "low"},
            output_format=esquema,
        )
    except Exception:  # noqa: BLE001 - red, 4xx, 5xx o esquema invalido: todo cae igual
        log.warning("llamada al LLM fallida; se usa la salida sin LLM", exc_info=True)
        return None
    if respuesta.stop_reason == "refusal":
        log.warning("el modelo declino la peticion; se usa la salida sin LLM")
        return None
    return respuesta.parsed_output
