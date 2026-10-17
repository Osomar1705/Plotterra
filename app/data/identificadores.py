"""Identificadores con prefijo legible. Facilita leer logs y reportar errores."""
from __future__ import annotations

import secrets

PREFIJOS = {
    "sesion": "ses",
    "parcela": "prc",
    "comparacion": "cmp",
    "alternativa": "alt",
    "cambio": "chg",
    "run": "run",
}


def nuevo_id(tipo: str, largo: int = 4) -> str:
    prefijo = PREFIJOS[tipo]
    return f"{prefijo}_{secrets.token_hex(largo // 2 + largo % 2)[:largo]}"
