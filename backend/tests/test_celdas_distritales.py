"""Las celdas son distritos: cobertura, busqueda por punto y suelo real."""
from __future__ import annotations

import pytest

from app.data.repository import REPO

AMBO = "100201"


@pytest.fixture(scope="module")
def repo():
    REPO.arrancar()
    if len(REPO.celdas) < 10:
        pytest.skip("paquete distrital no instalado")
    return REPO


def test_cubre_los_distritos_de_huanuco(repo):
    assert len(repo.celdas) == 84
    assert all(len(c["celda_id"]) == 6 and c["celda_id"].isdigit() for c in repo.celdas)


def test_la_chacra_de_ejemplo_cae_en_ambo(repo):
    c = repo.celda_por_punto(-76.175316, -10.112943)
    assert c is not None and c["celda_id"] == AMBO
    assert c["localidad"].lower() == "ambo"


def test_fuera_de_huanuco_no_tiene_celda(repo):
    assert repo.celda_por_punto(-77.05, -12.05) is None, "Lima no puede caer en una celda"
    assert repo.celda_por_punto(0.0, 0.0) is None


def test_el_suelo_ya_no_es_provisional(repo):
    d = repo.datasets_de(AMBO)
    assert d.suelo.provisional is False
    util = d.suelo.capacidad_campo_mm - d.suelo.punto_marchitez_mm
    assert util == pytest.approx(49.5, abs=0.2), "agua util publicada para Ambo"


def test_cada_distrito_tiene_clima_y_suelo(repo):
    """Muestra de distritos repartidos, no los 84, para no alargar la suite."""
    for celda in repo.celdas[::12]:
        d = repo.datasets_de(celda["celda_id"])
        assert d.clima_diario, f"{celda['celda_id']} sin clima"
        assert len(d.clima_diario) > 4000
        assert d.suelo.capacidad_campo_mm > d.suelo.punto_marchitez_mm


def test_distritos_distintos_dan_resultados_distintos(repo):
    """Si todos los distritos dieran lo mismo, la celda no estaria sirviendo."""
    from datetime import date

    from app.engine.contrato import Condiciones
    from app.engine.runner import ejecutar_comparacion

    def deficit(ubigeo: str) -> float:
        cond = Condiciones(
            parcela_id="p", area_ha=1.0, fecha_inicio=date(2026, 11, 1), cultivo_anterior=None,
            modo_agua="secano", lamina_mm_campania=0.0,
            cultivos_permitidos=["papa", "quinua", "haba", "cebada", "avena", "tarwi"],
            prioridad="agua", plan_habitual=None, cultivos_fijados={},
            horizonte_campanias=3, n_escenarios=30, semilla=7,
        )
        r = ejecutar_comparacion(cond, repo.datasets_de(ubigeo))
        return min(a.agua.deficit_mm_mediana for a in r.alternativas)

    bajo = deficit("101105")   # Jacas Chico, 3821 m
    ambo = deficit(AMBO)       # Ambo, 3051 m
    assert bajo != ambo, "dos distritos a alturas muy distintas no pueden dar el mismo deficit"


def test_la_lluvia_del_motor_es_la_de_chirps(repo):
    """El total mensual debe ser el de CHIRPS, no el de NASA POWER.

    La lluvia diaria de POWER cae a la mitad desde 2019 en todos los distritos
    (un quiebre de la serie, no del clima) y es identica entre distritos
    vecinos. El paquete de datos recomienda CHIRPS; POWER solo aporta que dias
    llueve.
    """
    import csv
    from collections import defaultdict
    from pathlib import Path

    chirps = {}
    with Path("datasets/lluvia_chirps_mensual.csv").open(encoding="utf-8-sig") as fh:
        for f in csv.DictReader(fh):
            if f["ubigeo"] == AMBO:
                chirps[f["fecha"][:7]] = float(f["lluvia_chirps_mm"])

    por_mes = defaultdict(float)
    for dia in repo.datasets_de(AMBO).clima_diario:
        por_mes[dia["fecha"][:7]] += dia["lluvia_mm"]

    assert len(por_mes) == len(chirps) == 156
    for mes, total in por_mes.items():
        assert total == pytest.approx(chirps[mes], abs=0.05), f"{mes}: {total} vs CHIRPS {chirps[mes]}"


def test_la_lluvia_no_tiene_el_quiebre_de_2019(repo):
    serie = repo.datasets_de(AMBO).clima_diario
    antes = sum(d["lluvia_mm"] for d in serie if "2013" <= d["fecha"][:4] <= "2018") / 6
    despues = sum(d["lluvia_mm"] for d in serie if d["fecha"][:4] >= "2019") / 7
    assert despues > antes * 0.75, f"la lluvia cae de {antes:.0f} a {despues:.0f} mm/anio: eso es el quiebre de POWER"


def test_distritos_vecinos_no_comparten_la_misma_lluvia(repo):
    """Con POWER, Ambo y Jacas Chico tenian exactamente los mismos numeros."""
    ambo = sum(d["lluvia_mm"] for d in repo.datasets_de(AMBO).clima_diario)
    jacas = sum(d["lluvia_mm"] for d in repo.datasets_de("101105").clima_diario)
    assert abs(ambo - jacas) > 100
