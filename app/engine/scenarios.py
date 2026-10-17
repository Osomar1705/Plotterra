"""Los cien escenarios con semilla fija. Responsable: Ronald.

Cada escenario es un ano climatico historico completo multiplicado por tres
factores. Usar anos reales en bloque conserva la correlacion entre lluvia y
temperatura, cosa que no ocurre si se sortea dia por dia.
"""
from __future__ import annotations

from typing import Any

FAMILIAS = {
    "condiciones_tipicas": 30,
    "menor_lluvia": 20,
    "menos_riego": 20,
    "caida_de_precio": 15,
    "combinado_adverso": 15,
}


def generar_escenarios(n: int, semilla: int, anios_disponibles: list[int]) -> list[dict[str, Any]]:
    """Pendiente: bloque de Ronald, dia 5.

    Devuelve n dicts con escenario_id, anio_base, factor_lluvia, factor_riego y
    factor_precio. Con la misma semilla devuelve exactamente lo mismo.
    """
    raise NotImplementedError("scenarios.generar_escenarios: bloque de Ronald")
