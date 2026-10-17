"""Caso de referencia del motor de agua. Responsable: Breyner, dia 4.

Este archivo es el entregable que define si el motor miente o no: una campania
de papa calculada a mano en papel, y el test que verifica que el codigo da lo
mismo. Hasta que water.balance_hidrico exista, test_water lo saltea.

Como llenarlo:
  1. Tomar 165 dias de clima de la celda hco_0412 y escribirlos en CLIMA.
  2. Calcular a mano ETc, ETa y deficit por etapa con los Kc de la ficha.
  3. Poner esos resultados en ESPERADO con su tolerancia.
"""
from __future__ import annotations

CLIMA: list[dict[str, float]] = []  # fecha, lluvia_mm, et0_mm

ESPERADO = {
    "demanda_mm": None,   # suma de ETc en la campania
    "deficit_mm": None,   # suma de ETc - ETa
    "tolerancia_mm": 2.0,
}
