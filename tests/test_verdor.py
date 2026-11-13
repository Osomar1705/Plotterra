"""El verdor confirma con satelite que la parcela es una chacra."""
from __future__ import annotations

from app.data.verdor import clasificar
from tests.conftest import BASE

DEMO = [[-76.176016, -10.112243], [-76.174616, -10.112243], [-76.174616, -10.113643],
        [-76.176016, -10.113643], [-76.176016, -10.112243]]


def _parcela(cliente, cuerpo):
    return cliente.post(f"{BASE}/parcelas", json=cuerpo).json()["parcela_id"]


def test_la_chacra_de_ejemplo_se_confirma_como_cultivo(cliente):
    pid = _parcela(cliente, {"geometria": {"type": "Polygon", "coordinates": [DEMO]}})
    v = cliente.get(f"{BASE}/parcelas/{pid}/verdor").json()
    assert v["disponible"] is True
    assert v["patron"] == "ciclo_de_cultivo"
    assert v["imagenes_despejadas"] == len(v["serie"]) > 200
    assert v["escenas_revisadas"] > v["imagenes_despejadas"], "las nubladas se cuentan, no se esconden"
    assert all(0 <= p["ndvi"] <= 1 for p in v["serie"])
    assert [p["fecha"] for p in v["serie"]] == sorted(p["fecha"] for p in v["serie"])
    assert len(v["ciclo_tipico"]) == 12
    # El ciclo de la sierra: verde en la temporada de lluvias, seco al final del estiaje.
    mes = {x["mes"]: x["ndvi_medio"] for x in v["ciclo_tipico"]}
    assert mes[4] > mes[10] + 0.2


def test_una_parcela_lejos_del_punto_medido_no_inventa_verdor(cliente):
    lejos = [[x + 0.02, y] for x, y in DEMO]
    pid = _parcela(cliente, {"geometria": {"type": "Polygon", "coordinates": [lejos]}})
    v = cliente.get(f"{BASE}/parcelas/{pid}/verdor").json()
    assert v["disponible"] is False
    assert v["motivo"] == "fuera_del_punto_medido"
    assert "serie" not in v


def test_sin_dibujo_no_hay_verdor(cliente):
    pid = _parcela(cliente, {"area_declarada_ha": 1.8, "localidad": "Ambo"})
    v = cliente.get(f"{BASE}/parcelas/{pid}/verdor").json()
    assert v["disponible"] is False and v["motivo"] == "sin_dibujo"


def test_parcela_inexistente_da_404(cliente):
    r = cliente.get(f"{BASE}/parcelas/prc_nada/verdor")
    assert r.status_code == 404
    assert r.json()["error"]["mensaje_agricultor"]


def test_cualquier_parcela_trae_el_verdor_de_su_distrito(cliente):
    """Lejos del punto medido no hay verdor de la parcela, pero si el del distrito."""
    lejos = [[x + 0.02, y] for x, y in DEMO]
    pid = _parcela(cliente, {"geometria": {"type": "Polygon", "coordinates": [lejos]}})
    v = cliente.get(f"{BASE}/parcelas/{pid}/verdor").json()
    assert v["disponible"] is False, "la parcela sigue sin verdor propio"
    d = v["verdor_distrito"]
    assert d["nivel"] == "distrito" and d["celda_id"]
    assert len(d["ciclo_tipico"]) == 12
    assert all(0 <= m["ndvi_mediana"] <= 1 for m in d["ciclo_tipico"])
    assert d["imagenes_despejadas"] > 100
    assert d["escenas_revisadas"] >= d["imagenes_despejadas"]
    assert "no tu parcela" in d["mensaje_agricultor"]
    assert "HLS" in d["fuente"]


def test_ambo_trae_estres_de_ecostress_en_la_epoca_seca(cliente):
    pid = _parcela(cliente, {"geometria": {"type": "Polygon", "coordinates": [DEMO]}})
    v = cliente.get(f"{BASE}/parcelas/{pid}/verdor").json()
    assert v["verdor_distrito"]["celda_id"] == "100201"
    e = v["estres_vegetacion"]
    assert e["indicador"] == "ESI" and "ECOSTRESS" in e["fuente"]
    # La falta de agua que ve ECOSTRESS cae en el estiaje, igual que el verdor mas bajo.
    assert set(e["meses_con_mas_estres"]) <= {6, 7, 8, 9, 10}
    assert set(v["verdor_distrito"]["meses_mas_secos"]) <= {7, 8, 9, 10, 11}
    assert 12 in e["meses_sin_datos"], "diciembre no tiene pasadas utiles: se declara, no se rellena"


def test_la_parcela_declarada_tambien_tiene_contexto_del_distrito(cliente):
    pid = _parcela(cliente, {"area_declarada_ha": 1.8, "localidad": "Ambo"})
    v = cliente.get(f"{BASE}/parcelas/{pid}/verdor").json()
    assert v["motivo"] == "sin_dibujo"
    assert v["verdor_distrito"]["nivel"] == "distrito"


def test_las_reglas_de_clasificacion():
    assert clasificar([0.1, 0.15, 0.2, 0.25, 0.22])[0] == "sin_vegetacion"
    assert clasificar([0.7, 0.72, 0.75, 0.8, 0.78, 0.74])[0] == "vegetacion_permanente"
    assert clasificar([0.35, 0.4, 0.55, 0.7, 0.75, 0.5, 0.38])[0] == "ciclo_de_cultivo"
    assert clasificar([0.5, 0.52, 0.55, 0.51, 0.53])[0] == "dudoso"
    assert clasificar([0.5, 0.6])[0] == "dudoso", "con pocas imagenes no se afirma nada"
