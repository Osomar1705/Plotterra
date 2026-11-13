"""Las siete reglas, cada una con su codigo y su mensaje para el agricultor."""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from tests.conftest import BASE


def _error(respuesta):
    cuerpo = respuesta.json()["error"]
    # El cuerpo unico: cinco campos mas el run_id, siempre.
    assert set(cuerpo) == {"codigo", "campo", "mensaje_tecnico", "mensaje_agricultor", "accion_sugerida", "run_id"}
    assert cuerpo["mensaje_agricultor"] and cuerpo["run_id"].startswith("run_")
    return cuerpo


def test_poligono_con_lados_que_se_cruzan(cliente):
    r = cliente.post(
        f"{BASE}/parcelas",
        json={
            "geometria": {
                "type": "Polygon",
                "coordinates": [[[-76.242, -9.931], [-76.239, -9.934], [-76.239, -9.931], [-76.242, -9.934], [-76.242, -9.931]]],
            }
        },
    )
    assert r.status_code == 422
    assert _error(r)["codigo"] == "POLIGONO_INVALIDO"


def test_poligono_sin_cerrar(cliente):
    r = cliente.post(
        f"{BASE}/parcelas",
        json={
            "geometria": {
                "type": "Polygon",
                "coordinates": [[[-76.242, -9.931], [-76.239, -9.931], [-76.239, -9.934]]],
            }
        },
    )
    assert _error(r)["codigo"] == "POLIGONO_INVALIDO"


def test_area_fuera_de_rango(cliente):
    r = cliente.post(f"{BASE}/parcelas", json={"area_declarada_ha": 120, "localidad": "Huanuco"})
    assert r.status_code == 422
    cuerpo = _error(r)
    assert cuerpo["codigo"] == "AREA_FUERA_DE_RANGO"
    assert cuerpo["accion_sugerida"] == "editar_area"


def test_parcela_fuera_de_cobertura(cliente):
    r = cliente.post(
        f"{BASE}/parcelas",
        json={
            "geometria": {
                "type": "Polygon",
                "coordinates": [[[-70.0, -15.0], [-69.997, -15.0], [-69.997, -15.003], [-70.0, -15.003], [-70.0, -15.0]]],
            }
        },
    )
    assert r.status_code == 503
    cuerpo = _error(r)
    assert cuerpo["codigo"] == "DATOS_NO_DISPONIBLES"
    assert cuerpo["accion_sugerida"] == "usar_parcela_demostrativa"


def test_fecha_anterior_a_hoy(cliente, condiciones):
    condiciones["fecha_inicio"] = (date.today() - timedelta(days=1)).isoformat()
    r = cliente.post(f"{BASE}/comparaciones", json=condiciones)
    assert r.status_code == 422
    assert _error(r)["codigo"] == "FECHA_SIN_VENTANA"


def test_fecha_sin_ventana_de_siembra(cliente, condiciones):
    hoy = date.today()
    condiciones["fecha_inicio"] = date(hoy.year + 1, 6, 15).isoformat()
    r = cliente.post(f"{BASE}/comparaciones", json=condiciones)
    cuerpo = _error(r)
    assert cuerpo["codigo"] == "FECHA_SIN_VENTANA"
    assert cuerpo["campo"] == "fecha_inicio"


def test_riego_sin_lamina(cliente, condiciones):
    condiciones["agua"] = {"modo": "riego_turnos", "confianza": "estimado"}
    r = cliente.post(f"{BASE}/comparaciones", json=condiciones)
    assert r.status_code == 422
    assert _error(r)["codigo"] == "AGUA_INVALIDA"


def test_lamina_fuera_de_rango(cliente, condiciones):
    condiciones["agua"] = {"modo": "riego_disponible", "lamina_mm_campania": 1500}
    assert _error(cliente.post(f"{BASE}/comparaciones", json=condiciones))["codigo"] == "AGUA_INVALIDA"


def test_secano_no_declara_lamina(cliente, condiciones):
    condiciones["agua"] = {"modo": "secano", "lamina_mm_campania": 100}
    assert _error(cliente.post(f"{BASE}/comparaciones", json=condiciones))["codigo"] == "AGUA_INVALIDA"


def test_un_solo_cultivo_tras_exclusiones(cliente, condiciones):
    condiciones["cultivos_permitidos"] = ["papa", "cebada"]
    condiciones["cultivos_excluidos"] = [{"cultivo": "cebada", "motivo": "sin_comprador"}]
    r = cliente.post(f"{BASE}/comparaciones", json=condiciones)
    cuerpo = _error(r)
    assert cuerpo["codigo"] == "CULTIVOS_INSUFICIENTES"
    assert cuerpo["accion_sugerida"] == "editar_cultivos"
    assert "1 disponible" in cuerpo["mensaje_tecnico"]


def test_prioridad_invalida(cliente, condiciones):
    condiciones["prioridad"] = "rendimiento"
    r = cliente.post(f"{BASE}/comparaciones", json=condiciones)
    assert r.status_code == 422
    assert _error(r)["codigo"] == "ENTRADA_INVALIDA"


def test_plan_habitual_con_dos_campanias(cliente, condiciones):
    condiciones["plan_habitual"] = ["papa", "cebada"]
    r = cliente.post(f"{BASE}/comparaciones", json=condiciones)
    assert _error(r)["codigo"] == "PLAN_HABITUAL_INVALIDO"


def test_comparacion_inexistente(cliente):
    r = cliente.get(f"{BASE}/comparaciones/cmp_nada")
    assert r.status_code == 404
    assert _error(r)["codigo"] == "NO_ENCONTRADO"


def test_un_cuadrilatero_dibujado_a_mano_se_acepta():
    """Los lados primero y ultimo comparten vertice: tocarse ahi no es cruzarse.

    La comprobacion de cruces saltaba el par (0, ultimo) pero no (ultimo, 0),
    asi que rechazaba cualquier parcela de cuatro esquinas dibujada en el mapa.
    """
    from app.api.validaciones import validar_poligono

    dibujada = [
        [-76.1800, -10.1100], [-76.1740, -10.1095],
        [-76.1735, -10.1160], [-76.1795, -10.1150], [-76.1800, -10.1100],
    ]
    assert len(validar_poligono({"type": "Polygon", "coordinates": [dibujada]})) == 4


def test_un_poligono_que_si_se_cruza_sigue_fallando():
    from app.api.errors import ErrorFieldShift
    from app.api.validaciones import validar_poligono

    reloj_de_arena = [
        [-76.18, -10.11], [-76.17, -10.12],
        [-76.17, -10.11], [-76.18, -10.12], [-76.18, -10.11],
    ]
    with pytest.raises(ErrorFieldShift) as exc:
        validar_poligono({"type": "Polygon", "coordinates": [reloj_de_arena]})
    assert exc.value.codigo.value == "POLIGONO_INVALIDO"


def test_los_cultivos_excluidos_llegan_con_los_nombres_del_frontend():
    """El frontend manda {crop, reason}; el contrato pide {cultivo, motivo}."""
    from app.api.compat import normalizar_condiciones, validar
    from app.schemas.entrada import CondicionesComparacion

    cuerpo = normalizar_condiciones({
        "plotId": "prc_1", "startDate": "2026-12-01", "waterMode": "rainfed",
        "allowedCrops": ["papa", "quinua", "haba"], "priority": "water", "horizon": 3,
        "excludedCrops": [{"crop": "cebada", "reason": "sin_comprador"}],
    })
    cond = validar(CondicionesComparacion, cuerpo)
    assert [(e.cultivo, e.motivo) for e in cond.cultivos_excluidos] == [("cebada", "sin_comprador")]
