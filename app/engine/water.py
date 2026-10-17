"""Balance hidrico diario. Responsable: Breyner.

Firma congelada en engine/contrato.py (BalanceHidrico). Funcion pura: no importa
FastAPI ni SQLite y se prueba sola con pytest contra tests/caso_referencia.py.
"""
from __future__ import annotations

from typing import Any

from app.engine.contrato import BalanceResultado, EtapaCultivo, Suelo


def balance_hidrico(
    clima: Any,
    suelo: Suelo,
    etapas: list[EtapaCultivo],
    lamina_riego_mm: float,
) -> BalanceResultado:
    """Pendiente: bloque de Breyner, dia 4.

    Pasos acordados:
      1. ETc diaria = Kc(etapa) x ET0
      2. Lluvia efectiva: el excedente sobre capacidad de campo se pierde
      3. Almacenamiento = anterior + lluvia efectiva + riego - ETa,
         acotado entre punto de marchitez y capacidad de campo
      4. Deficit = suma de ETc - ETa, acumulado por etapa
    """
    raise NotImplementedError("water.balance_hidrico: bloque de Breyner")
