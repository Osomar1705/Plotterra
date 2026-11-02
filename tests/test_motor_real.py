"""El motor real de punta a punta: rotaciones, escenarios, seleccion."""
from __future__ import annotations

from datetime import date

import pytest

from app.data.repository import REPO
from app.engine import rotations, scenarios
from app.engine.contrato import Condiciones
from app.engine.runner import ejecutar_comparacion

TODOS = ["papa", "quinua", "haba", "cebada", "avena", "tarwi"]


@pytest.fixture(scope="module")
def datasets():
    REPO.arrancar()
    d = REPO.datasets_de("hco_0412")
    if d.clima_diario is None:
        pytest.skip("datasets/clima_diario.csv no esta presente")
    return d


def _condiciones(**cambios) -> Condiciones:
    base = dict(
        parcela_id="p_test", area_ha=1.0, fecha_inicio=date(2026, 11, 1),
        cultivo_anterior=None, modo_agua="secano", lamina_mm_campania=0.0,
        cultivos_permitidos=list(TODOS), prioridad="agua", plan_habitual=None,
        cultivos_fijados={}, horizonte_campanias=3, n_escenarios=100, semilla=7,
    )
    base.update(cambios)
    return Condiciones(**base)


def test_escenarios_reproducibles():
    a = scenarios.generar_escenarios(100, 7, list(range(2016, 2026)))
    b = scenarios.generar_escenarios(100, 7, list(range(2016, 2026)))
    c = scenarios.generar_escenarios(100, 8, list(range(2016, 2026)))
    assert a == b, "la misma semilla debe dar exactamente lo mismo"
    assert a != c, "semillas distintas deben dar escenarios distintos"
    assert len(a) == 100


def test_las_rotaciones_no_repiten_familia(datasets):
    validas, motivos = rotations.generar_rotaciones(_condiciones(), datasets)
    assert validas
    for secuencia in validas:
        familias = [datasets.fichas[c].familia for c in secuencia]
        assert all(a != b for a, b in zip(familias, familias[1:])), secuencia
    assert motivos.get("repite_familia_consecutiva", 0) > 0


def test_el_cultivo_anterior_excluye_su_familia(datasets):
    validas, _ = rotations.generar_rotaciones(_condiciones(cultivo_anterior="papa"), datasets)
    familia_papa = datasets.fichas["papa"].familia
    assert validas
    assert all(datasets.fichas[s[0]].familia != familia_papa for s in validas)


def test_cultivo_fijado_se_respeta(datasets):
    validas, _ = rotations.generar_rotaciones(_condiciones(cultivos_fijados={1: "papa"}), datasets)
    assert validas
    assert all(s[0] == "papa" for s in validas)


def test_devuelve_tres_alternativas_distintas(datasets):
    r = ejecutar_comparacion(_condiciones(), datasets)
    assert len(r.alternativas) == 3
    ids = [a.alternativa_id for a in r.alternativas]
    assert sorted(ids) == ["alt_agua", "alt_economia", "alt_suelo"]
    secuencias = [tuple(c.cultivo for c in a.secuencia) for a in r.alternativas]
    assert len(set(secuencias)) == 3, f"hay tarjetas repetidas: {secuencias}"


def test_la_prioridad_queda_destacada(datasets):
    for prioridad in ("agua", "economia", "suelo"):
        r = ejecutar_comparacion(_condiciones(prioridad=prioridad), datasets)
        destacadas = [a for a in r.alternativas if a.destacada]
        assert len(destacadas) == 1
        assert destacadas[0].criterio.value == prioridad


def test_cada_criterio_gana_en_lo_suyo(datasets):
    r = ejecutar_comparacion(_condiciones(), datasets)
    por_id = {a.alternativa_id: a for a in r.alternativas}
    assert por_id["alt_economia"].economia.margen_soles_ha_mediana >= por_id["alt_agua"].economia.margen_soles_ha_mediana
    assert por_id["alt_agua"].agua.deficit_mm_mediana <= por_id["alt_economia"].agua.deficit_mm_mediana
    assert por_id["alt_suelo"].suelo.indice >= por_id["alt_economia"].suelo.indice


def test_reproducible_con_la_misma_semilla(datasets):
    a = ejecutar_comparacion(_condiciones(), datasets)
    b = ejecutar_comparacion(_condiciones(), datasets)
    assert [x.model_dump() for x in a.alternativas] == [x.model_dump() for x in b.alternativas]


def test_menos_riego_no_mejora_el_deficit(datasets):
    """Regar menos no puede bajar el deficit. Es la pregunta del chatbot."""
    con = ejecutar_comparacion(_condiciones(modo_agua="riego", lamina_mm_campania=200.0), datasets)
    sin = ejecutar_comparacion(_condiciones(modo_agua="riego", lamina_mm_campania=50.0), datasets)
    mejor_con = min(a.agua.deficit_mm_mediana for a in con.alternativas)
    mejor_sin = min(a.agua.deficit_mm_mediana for a in sin.alternativas)
    assert mejor_con <= mejor_sin


def test_sin_rotaciones_viables_no_revienta(datasets):
    """Un solo cultivo y horizonte 3: imposible sin repetir familia."""
    r = ejecutar_comparacion(_condiciones(cultivos_permitidos=["papa"]), datasets)
    assert r.alternativas == []
    assert r.descartadas.inviables > 0


def test_dentro_del_presupuesto(datasets):
    import time

    inicio = time.perf_counter()
    ejecutar_comparacion(_condiciones(), datasets)
    duracion_ms = (time.perf_counter() - inicio) * 1000
    assert duracion_ms < 8000, f"tardo {duracion_ms:.0f} ms, el presupuesto es 8000"
