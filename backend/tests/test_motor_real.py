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
    d = REPO.datasets_de("100201")
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


def test_cada_campania_trae_sus_propias_metricas(datasets):
    """La Vista 03 cambia las cifras al tocar cada nodo del abanico."""
    r = ejecutar_comparacion(_condiciones(), datasets)
    for alternativa in r.alternativas:
        for campania in alternativa.secuencia:
            m = campania.metricas
            assert m is not None, f"campania {campania.campania} sin metricas"
            assert m.demanda_mm > 0
            assert 0 <= m.deficit_mm <= m.demanda_mm
            assert m.rendimiento_t_ha >= 0
        distintas = {c.metricas.rendimiento_t_ha for c in alternativa.secuencia}
        assert len(distintas) > 1 or len({c.cultivo for c in alternativa.secuencia}) == 1, (
            "cultivos distintos deberian rendir distinto"
        )


def test_menos_lluvia_sube_el_deficit(datasets):
    """La pregunta central de la demo. El cambio de riego se satura; este no."""
    normal = ejecutar_comparacion(_condiciones(), datasets)
    seco = ejecutar_comparacion(_condiciones(factor_lluvia=0.6), datasets)
    d_normal = min(a.agua.deficit_mm_mediana for a in normal.alternativas)
    d_seco = min(a.agua.deficit_mm_mediana for a in seco.alternativas)
    assert d_seco > d_normal, f"con menos lluvia el deficit debe subir: {d_normal} -> {d_seco}"


def test_menos_precio_baja_el_margen(datasets):
    normal = ejecutar_comparacion(_condiciones(), datasets)
    barato = ejecutar_comparacion(_condiciones(factor_precio=0.5), datasets)
    m_normal = max(a.economia.margen_soles_ha_mediana for a in normal.alternativas)
    m_barato = max(a.economia.margen_soles_ha_mediana for a in barato.alternativas)
    assert m_barato < m_normal


def test_el_margen_declara_su_exposicion_a_los_costos(datasets):
    """Los costos no varian entre escenarios, asi que su incertidumbre no esta
    en el rango p10-p90. Si no se expone aparte, el margen aparenta mas
    precision de la que tiene."""
    r = ejecutar_comparacion(_condiciones(prioridad="economia"), datasets)
    for a in r.alternativas:
        e = a.economia
        assert e.costos_soles_ha > 0, "hay que decir con que costos se calculo"
        # Lo esperado sale de las fichas, no de una fecha: el flag debe apagarse
        # solo el dia que los costos de la rotacion tengan fuente.
        fichas = [datasets.fichas[c.cultivo] for c in a.secuencia]
        esperado = any(
            "costos_soles_ha" in f.provisional_campos if f.provisional_campos else f.provisional
            for f in fichas
        )
        assert e.costos_provisionales is esperado

        s = e.margen_sensibilidad_costos
        assert s["si_costaran_25_mas"] < e.margen_soles_ha_mediana < s["si_costaran_25_menos"]

        # La banda por costos debe ser proporcional a los costos, no al azar.
        banda = s["si_costaran_25_menos"] - s["si_costaran_25_mas"]
        assert banda == pytest.approx(e.costos_soles_ha * 0.5, rel=0.01)


def test_los_100_futuros_siguen_el_orden_de_los_escenarios(datasets):
    """La cuadricula del frontend compara el mismo futuro en las tres opciones."""
    import statistics

    r = ejecutar_comparacion(_condiciones(), datasets)
    n = len(r.escenarios)
    assert 0 < n <= 100
    for a in r.alternativas:
        v = a.futuros.margen_por_escenario
        assert len(v) == n and None not in v
        # Es la misma distribucion que resume la tarjeta, solo que sin ordenar.
        assert statistics.median(v) == pytest.approx(a.economia.margen_soles_ha_mediana, abs=0.01)
        o = a.outcomes
        assert o["wins"] + o["losses"] <= 100 and o["margin_by_scenario"] == v
        familias = {f["familia"] for f in a.stress_test}
        # Secano: sin la familia "menos riego", que no cambiaria nada.
        assert familias == {"tipica", "menos_lluvia", "caida_precio", "combinado"}
        tipica = next(f for f in a.stress_test if f["familia"] == "tipica")
        assert tipica["cambio_vs_tipica_S_ha"] == 0


def test_la_caida_de_precio_rinde_menos_que_el_anio_tipico(datasets):
    r = ejecutar_comparacion(_condiciones(), datasets)
    for a in r.alternativas:
        medios = a.futuros.margen_medio_por_familia
        assert medios["caida_de_precio"] < medios["condiciones_tipicas"]


def test_solo_se_exponen_futuros_simulados_en_las_tres(datasets):
    """Con riego y siembra a fines de anio, algunos anios base no alcanzan."""
    r = ejecutar_comparacion(
        _condiciones(fecha_inicio=date(2026, 11, 20), modo_agua="riego_turnos",
                     lamina_mm_campania=180.0, semilla=20261010),
        datasets,
    )
    n = len(r.escenarios)
    # Con el sorteo limitado a anios con el siguiente completo, no se pierde ninguno.
    assert n == 100
    assert all(len(a.futuros.margen_por_escenario) == n for a in r.alternativas)
    assert all(None not in a.futuros.margen_por_escenario for a in r.alternativas)


def _riego(**cambios):
    base = dict(fecha_inicio=date(2026, 11, 20), modo_agua="riego_turnos", lamina_mm_campania=180.0,
                cultivo_anterior="papa", semilla=20261010)
    base.update(cambios)
    return _condiciones(**base)


def test_con_riego_existe_la_familia_menos_riego(datasets):
    r = ejecutar_comparacion(_riego(), datasets)
    assert "menos_riego" in {e["familia"] for e in r.escenarios}


def test_riego_disponible_rinde_al_menos_lo_mismo_que_por_turnos(datasets):
    """Misma lamina: regar cuando hace falta no puede dejar mas deficit."""
    from app.engine.water import balance_hidrico
    from app.engine.runner import _indexar_clima, _serie_del_anio

    clima = _indexar_clima(datasets.clima_diario)
    ficha = REPO.fichas["papa"]
    peor_turnos = peor_demanda = 0.0
    for anio in (2016, 2018, 2023):
        serie = _serie_del_anio(clima, anio, date(2026, 11, 20), ficha.duracion_dias, 0.6)
        turnos = balance_hidrico(serie, datasets.suelo, ficha.etapas, 120.0)
        demanda = balance_hidrico(serie, datasets.suelo, ficha.etapas, 120.0, a_demanda=True)
        assert demanda.deficit_mm <= turnos.deficit_mm + 0.01
        peor_turnos += turnos.deficit_mm
        peor_demanda += demanda.deficit_mm
    assert peor_demanda < peor_turnos  # en anios secos se nota


def test_la_tarjeta_economia_tiene_el_mayor_margen(datasets):
    """Con riego de sobra todos empatan en deficit: Agua no debe quedarse con el plan mas rentable."""
    r = ejecutar_comparacion(_riego(lamina_mm_campania=400.0, prioridad="agua"), datasets)
    margen = {a.alternativa_id: a.economia.margen_soles_ha_mediana for a in r.alternativas}
    assert margen["alt_economia"] == max(margen.values())


def test_el_precio_varia_entre_futuros_tipicos(datasets):
    """Antes el precio era siempre la mediana: los futuros tipicos con riego daban casi el mismo margen."""
    r = ejecutar_comparacion(_riego(), datasets)
    a = next(x for x in r.alternativas if x.alternativa_id == "alt_economia")
    tipicos = [v for e, v in zip(r.escenarios, a.futuros.margen_por_escenario) if e["familia"] == "condiciones_tipicas"]
    assert len({round(v, -1) for v in tipicos}) > len(tipicos) * 0.8
