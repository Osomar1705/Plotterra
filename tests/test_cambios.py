"""Un cambio crea una derivada y conserva la anterior. Chat y control coinciden."""
from __future__ import annotations

from tests.conftest import BASE


def _comparacion(cliente, condiciones):
    return cliente.post(f"{BASE}/comparaciones", json=condiciones).json()


def test_consulta_interpreta_sin_aplicar(cliente, condiciones):
    cmp = _comparacion(cliente, condiciones)
    r = cliente.post(f"{BASE}/consultas", json={"comparacion_id": cmp["comparacion_id"], "texto": "y si tengo 30% menos riego?"})
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["aplicable"] is True
    assert datos["requiere_confirmacion"] is True
    assert datos["interpretacion"]["intent"] == "ajustar_riego"
    assert datos["interpretacion"]["parametros"]["factor"] == 0.7
    assert datos["interpretacion"]["etiqueta"] == "riego -30 %"
    # La comparacion original no cambio: interpretar no recalcula.
    assert cliente.get(f"{BASE}/comparaciones/{cmp['comparacion_id']}").json()["escenarios_aplicados"] == []


def test_consulta_no_entendida_da_tres_salidas(cliente, condiciones):
    cmp = _comparacion(cliente, condiciones)
    r = cliente.post(f"{BASE}/consultas", json={"comparacion_id": cmp["comparacion_id"], "texto": "cuanto cuesta un tractor"})
    assert r.status_code == 200
    datos = r.json()
    assert datos["aplicable"] is False
    assert len(datos["sugerencias"]) == 3


def test_cambio_crea_derivada_y_conserva_la_anterior(cliente, condiciones):
    cmp = _comparacion(cliente, condiciones)
    r = cliente.post(
        f"{BASE}/comparaciones/{cmp['comparacion_id']}/cambios",
        json={"intent": "ajustar_riego", "parametros": {"factor": 0.7}, "origen": "chat"},
    )
    assert r.status_code == 200, r.text
    derivada = r.json()

    assert derivada["comparacion_id"] != cmp["comparacion_id"]
    assert derivada["derivada_de"] == cmp["comparacion_id"]
    assert len(derivada["escenarios_aplicados"]) == 1
    assert derivada["escenarios_aplicados"][0]["etiqueta"] == "riego -30 %"
    assert derivada["resumen_del_cambio"] is not None
    # Menos riego no puede bajar el deficit.
    assert derivada["resumen_del_cambio"]["deficit_delta_mm"] >= 0

    # La anterior sigue intacta: deshacer es volver a su identificador.
    anterior = cliente.get(f"{BASE}/comparaciones/{cmp['comparacion_id']}").json()
    assert anterior["alternativas"] == cmp["alternativas"]

    cambio_id = derivada["escenarios_aplicados"][0]["cambio_id"]
    vuelta = cliente.delete(f"{BASE}/comparaciones/{derivada['comparacion_id']}/cambios/{cambio_id}")
    assert vuelta.status_code == 200
    assert vuelta.json()["comparacion_id"] == cmp["comparacion_id"]


def test_chat_y_control_producen_el_mismo_resultado(cliente, condiciones):
    """Requisito del documento de frontend: el origen no cambia el resultado."""
    base = _comparacion(cliente, condiciones)
    por_chat = cliente.post(
        f"{BASE}/comparaciones/{base['comparacion_id']}/cambios",
        json={"intent": "ajustar_riego", "parametros": {"factor": 0.7}, "origen": "chat"},
    ).json()
    por_control = cliente.post(
        f"{BASE}/comparaciones/{base['comparacion_id']}/cambios",
        json={"intent": "ajustar_riego", "parametros": {"factor": 0.7}, "origen": "control"},
    ).json()
    assert por_chat["alternativas"] == por_control["alternativas"]


def test_excluir_cultivo_lo_saca_de_las_secuencias(cliente, condiciones):
    base = _comparacion(cliente, condiciones)
    derivada = cliente.post(
        f"{BASE}/comparaciones/{base['comparacion_id']}/cambios",
        json={"intent": "excluir_cultivo", "parametros": {"cultivo": "quinua", "motivo": "sin_comprador"}},
    ).json()
    cultivos = {c["cultivo"] for a in derivada["alternativas"] for c in a["secuencia"]}
    assert "quinua" not in cultivos
    assert derivada["escenarios_aplicados"][-1]["etiqueta"] == "sin quinua"


def test_cambiar_prioridad_mueve_la_destacada(cliente, condiciones):
    base = _comparacion(cliente, condiciones)
    assert next(a["criterio"] for a in base["alternativas"] if a["destacada"]) == "agua"
    derivada = cliente.post(
        f"{BASE}/comparaciones/{base['comparacion_id']}/cambios",
        json={"intent": "cambiar_prioridad", "parametros": {"prioridad": "economia"}},
    ).json()
    assert next(a["criterio"] for a in derivada["alternativas"] if a["destacada"]) == "economia"


def test_factor_de_riego_fuera_de_rango(cliente, condiciones):
    base = _comparacion(cliente, condiciones)
    r = cliente.post(
        f"{BASE}/comparaciones/{base['comparacion_id']}/cambios",
        json={"intent": "ajustar_riego", "parametros": {"factor": 3.0}},
    )
    assert r.status_code == 422
    assert r.json()["error"]["codigo"] == "AGUA_INVALIDA"


def test_fijar_cultivo_en_una_campania_cambia_el_resultado(cliente, condiciones):
    """No basta con aceptar el intent y poner la etiqueta: el plan debe cambiar."""
    base = _comparacion(cliente, condiciones)
    derivada = cliente.post(
        f"{BASE}/comparaciones/{base['comparacion_id']}/cambios",
        json={"intent": "fijar_cultivo_campania", "parametros": {"cultivo": "haba", "campania": 1}},
    ).json()

    assert derivada["escenarios_aplicados"][-1]["etiqueta"] == "haba en campania 1"
    # Toda alternativa arranca con haba, y el descarte queda explicado.
    assert all(a["secuencia"][0]["cultivo"] == "haba" for a in derivada["alternativas"])
    assert derivada["descartadas"]["motivos"]["no_respeta_cultivo_fijado"] > 0
    assert derivada["motor"]["rotaciones_evaluadas"] < base["motor"]["rotaciones_evaluadas"]


def test_no_se_puede_fijar_un_cultivo_no_habilitado(cliente, condiciones):
    base = _comparacion(cliente, condiciones)
    r = cliente.post(
        f"{BASE}/comparaciones/{base['comparacion_id']}/cambios",
        json={"intent": "fijar_cultivo_campania", "parametros": {"cultivo": "cebada", "campania": 2}},
    )
    assert r.status_code == 422
    assert r.json()["error"]["codigo"] == "CULTIVOS_INSUFICIENTES"
