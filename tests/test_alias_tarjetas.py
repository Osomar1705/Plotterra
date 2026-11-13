"""La tarjeta del frontend rotula riesgo y calidad con claves en ingles.

Si el backend solo manda los niveles en espanol, la fila de riesgo y el
recuadro de calidad salen en blanco. Estas pruebas fijan los alias.
"""
from tests.conftest import BASE

RIESGO = {"bajo": "low", "medio": "medium", "alto": "high"}
CALIDAD = {"completa": "sufficient", "limitada": "limited", "pobre": "insufficient"}


def test_riesgo_y_calidad_viajan_en_ingles(cliente, condiciones):
    cuerpo = cliente.post(f"{BASE}/comparaciones", json=condiciones).json()
    assert cuerpo["alternativas"]
    for alt in cuerpo["alternativas"]:
        assert alt["risk"]["level"] == RIESGO[alt["riesgo"]["nivel"]]
        assert alt["risk"]["main_cause"] == alt["riesgo"]["principal"]
        assert alt["data_quality"]["level"] == CALIDAD[alt["calidad_informacion"]["nivel"]]
        assert alt["data_quality"]["main_gap"] == alt["calidad_informacion"]["dato_critico"]
        # El canonico no cambia: los niveles en espanol siguen ahi.
        assert alt["riesgo"]["nivel"] in RIESGO
        assert alt["calidad_informacion"]["nivel"] in CALIDAD


def test_los_alias_sobreviven_a_la_cache(cliente, condiciones):
    """La segunda peticion igual sale de disco y se revalida: los alias deben seguir."""
    cliente.post(f"{BASE}/comparaciones", json=condiciones)
    cuerpo = cliente.post(f"{BASE}/comparaciones", json=condiciones).json()
    assert cuerpo["motor"]["fuente_resultado"] == "cache"
    assert all(a["risk"]["level"] in RIESGO.values() for a in cuerpo["alternativas"])
    assert all(a["data_quality"]["level"] in CALIDAD.values() for a in cuerpo["alternativas"])
