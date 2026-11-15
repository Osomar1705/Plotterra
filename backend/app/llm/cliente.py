"""Cliente de Anthropic compartido por intent.py y explain.py.

Se construye una sola vez y solo si hay clave. Cualquier fallo aqui devuelve
None: los dos llamadores tienen su propia salida sin LLM, asi que una API caida
nunca tumba un endpoint.

Como ese fallo es silencioso a proposito, se guarda el ultimo error (tipo,
codigo HTTP y mensaje de la API, nunca la clave) para que /guide-health pueda
decir por que el chat esta usando reglas.
"""
from __future__ import annotations

import logging
import time
from typing import Any, TypeVar

from pydantic import BaseModel

from app.config import CONFIG

log = logging.getLogger("fieldshift")

T = TypeVar("T", bound=BaseModel)

_cliente: Any | None = None
_intentado = False
_ultimo_error: dict | None = None
_ultima_prueba: tuple[float, dict] | None = None
_PRUEBA_TTL_S = 60

# Que significa cada error para quien configura el despliegue.
_PISTAS = {
    401: "La clave no es valida: revisa ANTHROPIC_API_KEY en Render (sin espacios ni comillas).",
    403: "La clave no tiene permiso para este modelo o esta organizacion.",
    404: "El modelo no existe para esta clave: revisa FIELDSHIFT_MODELO_LLM.",
    429: "Limite de uso alcanzado: espera o revisa los limites de la cuenta.",
    529: "La API esta sobrecargada; vuelve a intentar en unos minutos.",
}


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
        _registrar_error(tipo="ImportError", detalle="paquete anthropic no instalado")
        return None
    # Sin reintentos: el presupuesto es corto y ambos llamadores tienen una
    # salida deterministica. Un reintento se lo comeria entero.
    _cliente = anthropic.Anthropic(
        api_key=CONFIG.anthropic_api_key,
        timeout=CONFIG.presupuesto_ms / 1000,
        max_retries=0,
    )
    return _cliente


def _registrar_error(*, tipo: str, status: int | None = None, detalle: str = "") -> dict:
    global _ultimo_error
    pista = _PISTAS.get(status or 0, "")
    texto = detalle.lower()
    if status == 400 and "credit" in texto:
        pista = "La cuenta de Anthropic no tiene saldo: agrega creditos en console.anthropic.com."
    elif tipo in {"APITimeoutError", "APIConnectionError"}:
        pista = "No hubo respuesta a tiempo; sube FIELDSHIFT_PRESUPUESTO_MS si se repite."
    _ultimo_error = {
        "tipo": tipo,
        "status": status,
        "detalle": detalle[:300],
        "pista": pista,
        "cuando": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    return _ultimo_error


def _describir(exc: Exception) -> dict:
    status = getattr(exc, "status_code", None)
    detalle = str(exc)
    cuerpo = getattr(exc, "body", None)
    if isinstance(cuerpo, dict):
        err = cuerpo.get("error") if isinstance(cuerpo.get("error"), dict) else cuerpo
        detalle = f"{err.get('type', '')}: {err.get('message', '')}".strip(": ")
    return _registrar_error(tipo=type(exc).__name__, status=status, detalle=detalle)


def ultimo_error() -> dict | None:
    return _ultimo_error


def responder(
    *,
    sistema: str,
    mensaje: str,
    esquema: type[T],
    max_tokens: int = 2048,
) -> T | None:
    """Pide una respuesta que cumpla `esquema`. None si no se pudo."""
    global _ultimo_error
    cliente = _obtener_cliente()
    if cliente is None:
        return None
    try:
        # parse() mete el esquema en output_config.format junto al effort.
        respuesta = cliente.messages.parse(
            model=CONFIG.modelo_llm,
            max_tokens=max_tokens,
            system=sistema,
            messages=[{"role": "user", "content": mensaje}],
            output_config={"effort": "low"},
            output_format=esquema,
        )
    except Exception as exc:  # noqa: BLE001 - red, 4xx, 5xx o esquema invalido: todo cae igual
        info = _describir(exc)
        log.warning("llamada al LLM fallida (%s %s): %s", info["tipo"], info["status"], info["detalle"])
        return None
    if respuesta.stop_reason == "refusal":
        _registrar_error(tipo="refusal", detalle="el modelo declino la peticion")
        log.warning("el modelo declino la peticion; se usa la salida sin LLM")
        return None
    if respuesta.stop_reason == "max_tokens" or respuesta.parsed_output is None:
        _registrar_error(tipo="salida_incompleta", detalle=f"stop_reason={respuesta.stop_reason}")
        log.warning("respuesta del LLM incompleta (%s); se usa la salida sin LLM", respuesta.stop_reason)
        return None
    _ultimo_error = None
    return respuesta.parsed_output


def probar() -> dict:
    """Llamada minima para saber si la clave y el modelo funcionan.

    Se guarda un minuto para que refrescar /guide-health?probe=true no gaste
    saldo en cada visita.
    """
    global _ultima_prueba
    ahora = time.monotonic()
    if _ultima_prueba and ahora - _ultima_prueba[0] < _PRUEBA_TTL_S:
        return {**_ultima_prueba[1], "en_cache": True}
    cliente = _obtener_cliente()
    if cliente is None:
        resultado = {"ok": False, "error": _ultimo_error or {"tipo": "sin_clave", "pista": "ANTHROPIC_API_KEY no esta configurada."}}
    else:
        inicio = time.monotonic()
        try:
            r = cliente.messages.create(
                model=CONFIG.modelo_llm,
                max_tokens=64,
                output_config={"effort": "low"},
                messages=[{"role": "user", "content": "Responde solo: ok"}],
            )
            resultado = {"ok": True, "modelo_respondio": r.model, "stop_reason": r.stop_reason,
                         "latencia_ms": round((time.monotonic() - inicio) * 1000)}
        except Exception as exc:  # noqa: BLE001
            resultado = {"ok": False, "error": _describir(exc),
                         "latencia_ms": round((time.monotonic() - inicio) * 1000)}
    _ultima_prueba = (ahora, resultado)
    return resultado
