"""Los cien escenarios con semilla fija.

Cada escenario es un ano climatico historico completo multiplicado por tres
factores. Usar anos reales en bloque conserva la correlacion entre lluvia y
temperatura, cosa que no ocurre si se sortea dia por dia.
"""
from __future__ import annotations

import random
from typing import Any

FAMILIAS = {
    "condiciones_tipicas": 30,
    "menor_lluvia": 20,
    "menos_riego": 20,
    "caida_de_precio": 15,
    "combinado_adverso": 15,
}

# Rango de cada factor adverso. 1.0 = sin alterar el ano historico.
RANGOS = {
    "menor_lluvia": {"factor_lluvia": (0.55, 0.85)},
    "menos_riego": {"factor_riego": (0.35, 0.75)},
    "caida_de_precio": {"factor_precio": (0.60, 0.85)},
    "combinado_adverso": {
        "factor_lluvia": (0.55, 0.80),
        "factor_riego": (0.40, 0.80),
        "factor_precio": (0.65, 0.90),
    },
}


def _reparto(n: int, con_riego: bool = True) -> list[str]:
    """Reparte n escenarios entre las familias conservando sus proporciones.

    Sin riego, "menos riego" no cambia nada (recortar cero da cero): su cuota
    pasa a "menor lluvia", que es el golpe que si sufre una chacra de secano.
    """
    pesos = dict(FAMILIAS)
    if not con_riego:
        pesos["menor_lluvia"] += pesos.pop("menos_riego")
    total = sum(pesos.values())
    cuenta = {f: max(1, round(n * p / total)) for f, p in pesos.items()}
    familias: list[str] = []
    for f, c in cuenta.items():
        familias.extend([f] * c)
    # El redondeo puede pasarse o quedarse corto: se ajusta con la familia mayor.
    mayor = max(pesos, key=lambda f: pesos[f])
    while len(familias) > n:
        familias.remove(mayor if mayor in familias else familias[-1])
    while len(familias) < n:
        familias.append(mayor)
    return familias[:n]


def generar_escenarios(
    n: int, semilla: int, anios_disponibles: list[int], con_riego: bool = True
) -> list[dict[str, Any]]:
    """n escenarios reproducibles. Con la misma semilla devuelve lo mismo."""
    if not anios_disponibles:
        raise ValueError("no hay anios climaticos disponibles para muestrear")

    rng = random.Random(semilla)
    anios = sorted(anios_disponibles)
    escenarios: list[dict[str, Any]] = []

    for i, familia in enumerate(_reparto(max(1, int(n)), con_riego)):
        factores = {"factor_lluvia": 1.0, "factor_riego": 1.0, "factor_precio": 1.0}
        for campo, (lo, hi) in RANGOS.get(familia, {}).items():
            factores[campo] = round(rng.uniform(lo, hi), 3)
        escenarios.append(
            {
                "escenario_id": f"esc_{i:03d}",
                "familia": familia,
                "anio_base": anios[rng.randrange(len(anios))],
                **factores,
            }
        )
    return escenarios
