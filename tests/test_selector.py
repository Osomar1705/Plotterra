"""Prueba del selector. Responsable: Ronald.

Mientras tanto se verifica la regla de dominancia sobre el motor de ejemplo, que
es la misma que debe cumplir el selector real.
"""
from __future__ import annotations

from app.mocks.motor_ejemplo import _dominada


def test_una_rotacion_peor_en_todo_esta_dominada():
    buena = {"margen": 5000, "deficit_mediana": 40, "indice_suelo": 0.8}
    mala = {"margen": 3000, "deficit_mediana": 90, "indice_suelo": 0.5}
    assert _dominada(mala, buena)
    assert not _dominada(buena, mala)


def test_un_intercambio_no_es_dominancia():
    mas_margen = {"margen": 5000, "deficit_mediana": 90, "indice_suelo": 0.5}
    menos_deficit = {"margen": 3000, "deficit_mediana": 40, "indice_suelo": 0.8}
    assert not _dominada(mas_margen, menos_deficit)
    assert not _dominada(menos_deficit, mas_margen)


def test_una_rotacion_no_se_domina_a_si_misma():
    a = {"margen": 4000, "deficit_mediana": 60, "indice_suelo": 0.7}
    assert not _dominada(a, dict(a))
