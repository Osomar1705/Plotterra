"""Misma entrada, mismo resultado. Es lo que permite grabar el video dos veces."""
from __future__ import annotations

from app.data.cache import clave_cache


def test_la_clave_depende_de_la_version_del_motor():
    comun = dict(
        geometria={"type": "Polygon", "coordinates": [[[0, 0], [0, 1], [1, 1], [0, 0]]]},
        area_ha=1.84,
        condiciones={"prioridad": "agua"},
        cambios=[],
        version_datasets="0.1.0",
    )
    a = clave_cache(version_motor="mock", **comun)
    b = clave_cache(version_motor="real", **comun)
    assert a != b, "corregir un parametro del motor no debe servir resultados viejos"


def test_la_clave_no_depende_del_orden_de_las_claves():
    base = dict(
        geometria=None,
        area_ha=2.0,
        cambios=[],
        version_motor="mock",
        version_datasets="0.1.0",
    )
    a = clave_cache(condiciones={"prioridad": "agua", "semilla": 1}, **base)
    b = clave_cache(condiciones={"semilla": 1, "prioridad": "agua"}, **base)
    assert a == b


def test_el_motor_de_ejemplo_es_determinista(cliente, condiciones):
    from tests.conftest import BASE

    uno = cliente.post(f"{BASE}/comparaciones", json=condiciones).json()
    # Otra semilla, otro ancho de dispersion; misma semilla, mismas cifras.
    condiciones_otra = dict(condiciones, escenarios={"n": 100, "semilla": 999})
    otra = cliente.post(f"{BASE}/comparaciones", json=condiciones_otra).json()
    assert uno["alternativas"][0]["economia"]["margen_soles_ha_mediana"] == (
        otra["alternativas"][0]["economia"]["margen_soles_ha_mediana"]
    ), "la mediana no depende de la semilla"
    assert uno["alternativas"][0]["economia"]["margen_soles_ha_p10"] != (
        otra["alternativas"][0]["economia"]["margen_soles_ha_p10"]
    ), "la dispersion si depende de la semilla"
