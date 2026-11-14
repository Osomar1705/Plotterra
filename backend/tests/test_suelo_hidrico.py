"""Criterios de aceptacion de la pedotransferencia. Bloque de Breyner.

Estas pruebas pasan hoy, con laminas_mm() devolviendo None y el motor usando
los valores declarados. Siguen pasando cuando se implemente: lo que verifican
son los limites fisicos, no un numero concreto.

Por eso no bloquean nada. Si se implementa mal, fallan; si no se implementa,
el motor sigue corriendo con la estimacion provisional y rotulada.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.engine.suelo_hidrico import FACTOR_MO, agua_aprovechable_mm, laminas_mm

SUELO_AMBO = json.loads(Path("datasets/suelo.json").read_text(encoding="utf-8"))["hco_0412"]
PROFUNDIDAD_CM = SUELO_AMBO["profundidad_cm"]

# Banda agronomica para un franco a 60 cm. Los valores provisionales dan 84 mm.
AGUA_APROVECHABLE_MIN_MM = 60.0
AGUA_APROVECHABLE_MAX_MM = 120.0


def test_la_textura_medida_esta_completa():
    """Sin estas entradas la formula no se puede aplicar."""
    t = SUELO_AMBO["textura_medida"]
    for campo in ("arcilla_pct", "arena_pct", "carbono_organico_g_kg", "densidad_aparente_kg_dm3"):
        assert campo in t, f"falta {campo} en datasets/suelo.json"
        assert t[campo] > 0
    assert 95 <= t["arcilla_pct"] + t["arena_pct"] + t["limo_pct"] <= 105, "las fracciones no suman 100 %"


def test_los_valores_vigentes_caen_en_la_banda():
    """Lo que el motor usa hoy, derivado o declarado, debe ser fisicamente sensato."""
    cc = SUELO_AMBO["capacidad_campo_mm"]
    pm = SUELO_AMBO["punto_marchitez_mm"]
    assert 0 < pm < cc, "punto de marchitez por encima de capacidad de campo"
    aprovechable = agua_aprovechable_mm(cc, pm)
    assert AGUA_APROVECHABLE_MIN_MM <= aprovechable <= AGUA_APROVECHABLE_MAX_MM, (
        f"{aprovechable:.0f} mm aprovechables fuera de la banda esperada para un franco"
    )


def test_la_pedotransferencia_respeta_la_fisica_cuando_exista():
    """Se saltea mientras laminas_mm devuelva None. No bloquea a nadie."""
    derivadas = laminas_mm(SUELO_AMBO["textura_medida"], PROFUNDIDAD_CM)
    if derivadas is None:
        pytest.skip("pedotransferencia pendiente: bloque de Breyner")

    cc, pm = derivadas
    assert 0 < pm < cc, "punto de marchitez por encima de capacidad de campo"

    # Porosidad total implicada por la densidad aparente, con densidad real 2.65.
    porosidad = 1 - SUELO_AMBO["textura_medida"]["densidad_aparente_kg_dm3"] / 2.65
    tope_mm = porosidad * PROFUNDIDAD_CM * 10
    assert cc < tope_mm, f"capacidad de campo {cc:.0f} mm supera la porosidad total {tope_mm:.0f} mm"

    aprovechable = agua_aprovechable_mm(cc, pm)
    assert AGUA_APROVECHABLE_MIN_MM <= aprovechable <= AGUA_APROVECHABLE_MAX_MM, (
        f"{aprovechable:.0f} mm aprovechables: revisar la conversion de unidades antes que la formula"
    )


def test_el_factor_de_materia_organica_es_el_convenido():
    assert FACTOR_MO == pytest.approx(1.724), "Van Bemmelen: carbono organico x 1.724 = materia organica"
