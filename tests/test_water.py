"""Prueba del motor de agua contra el caso calculado a mano.

Los valores esperados estan en tests/caso_referencia.py con su aritmetica
escrita. No se derivan de app.engine.water: ese es el punto de la prueba.
"""
from __future__ import annotations

import pytest

from app.engine.contrato import EtapaCultivo, Suelo
from app.engine.water import balance_hidrico
from tests.caso_referencia import (
    CLIMA,
    CLIMA_CON_LLUVIA,
    ESPERADO,
    ESPERADO_CON_LLUVIA,
    ETAPAS,
    SUELO,
)


def _suelo() -> Suelo:
    return Suelo(
        celda_id="caso_referencia",
        textura="franco",
        capacidad_campo_mm=SUELO["capacidad_campo_mm"],
        punto_marchitez_mm=SUELO["punto_marchitez_mm"],
        profundidad_cm=SUELO["profundidad_cm"],
        materia_organica_pct=2.0,
        fuente="caso sintetico de referencia",
        incertidumbre="nula",
        provisional=False,
    )


def _etapas() -> list[EtapaCultivo]:
    return [EtapaCultivo(**e) for e in ETAPAS]


@pytest.mark.parametrize(
    "clima,esperado,caso",
    [(CLIMA, ESPERADO, "A sin lluvia"), (CLIMA_CON_LLUVIA, ESPERADO_CON_LLUVIA, "B con 10 mm")],
)
def test_balance_hidrico_coincide_con_el_calculo_a_mano(clima, esperado, caso):
    r = balance_hidrico(clima, _suelo(), _etapas(), lamina_riego_mm=0.0)
    tol = esperado["tolerancia_mm"]

    assert r.demanda_mm == pytest.approx(esperado["demanda_mm"], abs=tol), f"demanda, caso {caso}"
    assert r.deficit_mm == pytest.approx(esperado["deficit_mm"], abs=tol), f"deficit, caso {caso}"
    assert r.almacenamiento_final_mm == pytest.approx(
        esperado["almacenamiento_final_mm"], abs=tol
    ), f"almacenamiento final, caso {caso}"

    por_etapa = {e.etapa: e.deficit_mm for e in r.por_etapa}
    assert por_etapa == pytest.approx(esperado["deficit_por_etapa"], abs=tol), f"por etapa, caso {caso}"


def test_el_riego_reduce_el_deficit():
    """30 mm de riego no pueden empeorar el balance."""
    secano = balance_hidrico(CLIMA, _suelo(), _etapas(), lamina_riego_mm=0.0)
    regado = balance_hidrico(CLIMA, _suelo(), _etapas(), lamina_riego_mm=30.0)
    assert regado.deficit_mm < secano.deficit_mm
    assert regado.demanda_mm == pytest.approx(secano.demanda_mm, abs=0.05), "el riego no cambia la demanda"


def test_invariantes_con_clima_real():
    """Sobre la serie real de Ambo (100201): ningun resultado fuera de rango fisico."""
    from app.data.repository import REPO

    REPO.arrancar()
    datasets = REPO.datasets_de("100201")
    serie = datasets.clima_diario
    if serie is None:
        pytest.skip("datasets/clima_diario.csv no esta presente")

    ficha = datasets.fichas["papa"]
    tramo = serie[:ficha.duracion_dias]
    r = balance_hidrico(tramo, datasets.suelo, ficha.etapas, lamina_riego_mm=0.0)

    assert r.demanda_mm > 0
    assert 0 <= r.deficit_mm <= r.demanda_mm, "el deficit no puede superar la demanda"
    assert (
        datasets.suelo.punto_marchitez_mm - 0.01
        <= r.almacenamiento_final_mm
        <= datasets.suelo.capacidad_campo_mm + 0.01
    ), "el almacenamiento salio del rango entre marchitez y capacidad de campo"
    for e in r.por_etapa:
        assert 0 <= e.eta_mm <= e.etc_mm + 0.01, f"ETa fuera de rango en la etapa {e.etapa}"
