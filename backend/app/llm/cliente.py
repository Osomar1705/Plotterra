"""Cliente OpenAI Responses API para FieldShift (solo en backend).

Devuelve modelos Pydantic o None. Los errores se registran sin exponer claves.
La ruta /guide-health?probe=true permite probar una solicitud real.
"""
from __future__ import annotations

import json
import logging
import time
from typing import TypeVar

import httpx
from pydantic import BaseModel

from app.config import CONFIG

log = logging.getLogger("fieldshift")
T = TypeVar("T", bound=BaseModel)
_ultimo_error: dict | None = None
_ultima_prueba: tuple[float, dict] | None = None
_PRUEBA_TTL_S = 60
_URL = "https://api.openai.com/v1/responses"
_PISTAS = {
    400: "Solicitud invalida o modelo no compatible. Revisa FIELDSHIFT_MODELO_LLM.",
    401: "OPENAI_API_KEY no es valida. Revisa la clave privada del backend en Render.",
    403: "La clave o el proyecto no tiene permiso para usar este modelo.",
    404: "El modelo no existe o no esta disponible en este proyecto; revisa FIELDSHIFT_MODELO_LLM.",
    429: "Limite de solicitudes o cuota de OpenAI alcanzada. Revisa Usage y Billing.",
    500: "Error interno de OpenAI. Intentalo de nuevo.",
    502: "Error temporal de conexion con OpenAI.",
    503: "OpenAI no esta disponible temporalmente.",
}


def _registrar_error(*, tipo: str, status: int | None = None, detalle: str = "") -> dict:
    global _ultimo_error
    pista = _PISTAS.get(status or 0, "")
    if status == 429 and ("quota" in detalle.lower() or "billing" in detalle.lower()):
        pista = "La cuenta de OpenAI no tiene cuota o saldo disponible. Revisa Billing y Usage."
    if tipo in {"TimeoutException", "ConnectError", "ReadTimeout", "ConnectTimeout"}:
        pista = "No hubo respuesta a tiempo. Verifica conexion o aumenta FIELDSHIFT_PRESUPUESTO_MS."
    _ultimo_error = {
        "tipo": tipo, "status": status, "detalle": detalle[:250], "pista": pista,
        "cuando": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    return _ultimo_error


def ultimo_error() -> dict | None:
    return _ultimo_error


# Si el modelo configurado no existe, no esta permitido para la clave o gasta todo el
# presupuesto "pensando" (modelos de razonamiento), se prueban estos en orden.
_RESPALDO = ("gpt-4.1-mini", "gpt-4o-mini")
_modelo_activo: str | None = None


def _modelos() -> list[str]:
    orden = [_modelo_activo, CONFIG.modelo_llm, *_RESPALDO]
    return list(dict.fromkeys(m for m in orden if m))


def _solicitar(*, instrucciones: str, entrada: str, max_tokens: int) -> dict:
    """Llama a Responses API con el primer modelo que funcione; recuerda cual fue."""
    global _modelo_activo
    ultimo: Exception | None = None
    for modelo in _modelos():
        try:
            raw = _solicitar_modelo(modelo, instrucciones=instrucciones, entrada=entrada, max_tokens=max_tokens)
        except OpenAIResponseError as exc:
            if exc.status_code in (400, 403, 404):
                log.warning("Modelo %s no usable (HTTP %s); probando el siguiente", modelo, exc.status_code)
                ultimo = exc
                continue
            raise
        if raw.get("status") != "completed" or not _texto(raw):
            log.warning("Modelo %s respondio incompleto/vacio; probando el siguiente", modelo)
            ultimo = ValueError("Respuesta incompleta o vacia de " + modelo)
            continue
        _modelo_activo = modelo
        return raw
    raise ultimo or RuntimeError("Ningun modelo de OpenAI respondio")


def _solicitar_modelo(modelo: str, *, instrucciones: str, entrada: str, max_tokens: int) -> dict:
    if not CONFIG.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY no esta configurada en el backend de Render")
    razona = modelo.startswith(("gpt-5", "o1", "o3", "o4"))
    payload = {
        "model": modelo,
        "instructions": instrucciones,
        "input": entrada,
        # Los modelos de razonamiento cuentan su "pensamiento" dentro de este limite.
        "max_output_tokens": max_tokens * 4 if razona else max_tokens,
        "store": False,
    }
    if razona:
        payload["reasoning"] = {"effort": "low"}
    with httpx.Client(timeout=max(2.0, CONFIG.presupuesto_ms / 1000.0)) as cliente:
        response = cliente.post(
            _URL,
            headers={"Authorization": f"Bearer {CONFIG.openai_api_key}", "Content-Type": "application/json"},
            json=payload,
        )
        # No registrar headers, solicitud o clave, ni exponer directamente la respuesta completa.
        if response.status_code >= 400:
            try:
                err = response.json().get("error", {})
                detalle = f"{err.get('code') or err.get('type') or ''}: {err.get('message') or ''}"
            except (ValueError, AttributeError):
                detalle = "Respuesta HTTP de error"
            raise OpenAIResponseError(response.status_code, detalle)
        response.raise_for_status()
        return response.json()


class OpenAIResponseError(Exception):
    def __init__(self, status: int, detalle: str):
        super().__init__(detalle[:250])
        self.status_code = status


def _texto(respuesta: dict) -> str:
    """Extrae output_text de la estructura HTTP de Responses API."""
    partes = []
    for item in respuesta.get("output", []):
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        for contenido in item.get("content", []):
            if isinstance(contenido, dict) and contenido.get("type") == "output_text":
                partes.append(contenido.get("text", ""))
    return "\n".join(partes).strip()


def _describir(exc: Exception) -> dict:
    return _registrar_error(
        tipo=type(exc).__name__,
        status=getattr(exc, "status_code", None),
        detalle=str(exc),
    )


def responder(*, sistema: str, mensaje: str, esquema: type[T], max_tokens: int = 2048) -> T | None:
    """Genera JSON validado por Pydantic; ninguna respuesta controla directamente el simulador."""
    global _ultimo_error
    if not CONFIG.openai_api_key:
        _registrar_error(tipo="sin_clave", detalle="OPENAI_API_KEY no configurada")
        return None
    try:
        instrucciones = (
            sistema + "\n\nResponde UNICAMENTE con un objeto JSON valido, sin markdown. "
            "Debe cumplir este esquema JSON:\n" + json.dumps(esquema.model_json_schema(), ensure_ascii=False)
        )
        raw = _solicitar(instrucciones=instrucciones, entrada=mensaje, max_tokens=max_tokens)
        if raw.get("status") != "completed":
            raise ValueError("Respuesta incompleta: " + str(raw.get("status")))
        texto = _texto(raw)
        if not texto:
            raise ValueError("OpenAI no devolvio texto (respuesta vacia o rechazo)")
        parsed = esquema.model_validate_json(texto)
    except Exception as exc:  # noqa: BLE001 - API externa: mantener fallback seguro
        info = _describir(exc)
        log.warning("OpenAI fallo (%s HTTP %s): %s", info["tipo"], info["status"], info["detalle"])
        return None
    _ultimo_error = None
    return parsed


def probar() -> dict:
    """Prueba real del modelo, cacheada 60s; no revela la clave."""
    global _ultima_prueba, _ultimo_error
    ahora = time.monotonic()
    if _ultima_prueba and ahora - _ultima_prueba[0] < _PRUEBA_TTL_S:
        return {**_ultima_prueba[1], "en_cache": True}
    if not CONFIG.openai_api_key:
        resultado = {"ok": False, "error": _registrar_error(tipo="sin_clave", detalle="OPENAI_API_KEY no esta configurada") }
    else:
        inicio = time.monotonic()
        try:
            raw = _solicitar(instrucciones="Respond only with the word ok.", entrada="ping", max_tokens=80)
            contenido = _texto(raw)
            if raw.get("status") != "completed" or not contenido:
                raise ValueError("OpenAI devolvio una respuesta vacia o incompleta")
            _ultimo_error = None
            resultado = {"ok": True, "modelo_respondio": raw.get("model") or _modelo_activo,
                         "latencia_ms": round((time.monotonic() - inicio) * 1000)}
        except Exception as exc:  # noqa: BLE001
            resultado = {"ok": False, "error": _describir(exc),
                         "latencia_ms": round((time.monotonic() - inicio) * 1000)}
    _ultima_prueba = (ahora, resultado)
    return resultado
