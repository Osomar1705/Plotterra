"""El contrato responde completo. Si una de estas pruebas falla, el frontend se rompe."""
from __future__ import annotations

from tests.conftest import BASE


def test_health_carga_los_datasets(cliente):
    datos = cliente.get(f"{BASE}/health").json()
    assert datos["estado"] == "ok"
    assert datos["cultivos_cargados"] == 6
    assert "100201" in datos["celdas_con_cobertura"], "Ambo debe estar entre las celdas cubiertas"


def test_catalogo_trae_limites_y_marca_provisionales(cliente):
    datos = cliente.get(f"{BASE}/catalogo").json()
    assert {c["cultivo"] for c in datos["cultivos"]} == {"papa", "quinua", "cebada", "avena", "haba", "tarwi"}
    assert datos["limites"]["area_ha"] == {"minimo": 0.05, "maximo": 50.0, "unidad": "ha"}
    assert datos["prioridades"] == ["economia", "agua", "suelo"]
    # La papa viene de la ficha INIA; los otros cinco siguen siendo semilla del equipo.
    provisionales = {c["cultivo"] for c in datos["cultivos"] if c["provisional"]}
    assert "papa" not in provisionales and len(provisionales) == 5


def test_parcela_calcula_area_y_sugiere_datos_revisables(parcela):
    assert parcela["parcela_id"].startswith("prc_")
    assert parcela["sesion_id"].startswith("ses_")
    assert 0.05 <= parcela["area_ha"] <= 50
    assert parcela["celda_id"] == "100201"
    assert parcela["origen_area"] == "dibujada"
    assert parcela["sugerencias"]["suelo"]["editable"] is True


def test_parcela_sin_geometria_con_hectareas_declaradas(cliente):
    r = cliente.post(f"{BASE}/parcelas", json={"area_declarada_ha": 2.5, "localidad": "Huanuco"})
    assert r.status_code == 201, r.text
    assert r.json()["origen_area"] == "declarada"
    assert r.json()["area_ha"] == 2.5


def test_comparacion_devuelve_tres_alternativas_con_unidades(cliente, condiciones):
    r = cliente.post(f"{BASE}/comparaciones", json=condiciones)
    assert r.status_code == 200, r.text
    datos = r.json()

    assert datos["comparacion_id"].startswith("cmp_")
    assert datos["estado"] == "listo"
    assert len(datos["alternativas"]) == 3
    assert [a["criterio"] for a in datos["alternativas"]] == ["economia", "agua", "suelo"]

    # destacada marca la que coincide con la prioridad: el frontend no lo deduce.
    destacadas = [a for a in datos["alternativas"] if a["destacada"]]
    assert len(destacadas) == 1 and destacadas[0]["criterio"] == "agua"

    # Ninguna tarjeta repetida.
    secuencias = [tuple(c["cultivo"] for c in a["secuencia"]) for a in datos["alternativas"]]
    assert len(set(secuencias)) == 3

    alt = datos["alternativas"][0]
    assert alt["economia"]["moneda"] == "PEN"
    assert alt["economia"]["margen_parcial"] is True
    assert alt["economia"]["margen_soles_ha_p10"] <= alt["economia"]["margen_soles_ha_mediana"]
    assert alt["economia"]["margen_soles_ha_mediana"] <= alt["economia"]["margen_soles_ha_p90"]
    assert 0 <= alt["suelo"]["indice"] <= 1
    assert len(alt["riesgo"]["detalle_por_campania"]) == 3
    # Ya existe la serie climatica diaria (NASA POWER), asi que faltan dos
    # datos criticos y la calidad es limitada. Sube a completa cuando lleguen
    # el analisis de suelo local y las fichas validadas.
    assert alt["calidad_informacion"]["nivel"] == "limitada"
    assert set(alt["calidad_informacion"]["faltantes"]) == {"fichas_de_cultivo_validadas"}
    assert alt["calidad_informacion"]["dato_critico"] == "fichas_de_cultivo_validadas"

    # El cultivo excluido no aparece en ninguna secuencia.
    assert all("cebada" not in s for s in secuencias)

    # Procedencia y plan habitual evaluado.
    assert datos["motor"]["fuente_resultado"] == "mock"
    assert datos["motor"]["semilla"] == 20261010
    assert datos["plan_habitual"]["evaluado"] is True
    assert datos["descartadas"]["motivos"]


def test_la_misma_entrada_sale_de_cache(cliente, condiciones):
    primera = cliente.post(f"{BASE}/comparaciones", json=condiciones).json()
    segunda = cliente.post(f"{BASE}/comparaciones", json=condiciones).json()
    assert segunda["motor"]["fuente_resultado"] == "cache"
    assert segunda["comparacion_id"] == primera["comparacion_id"]
    assert segunda["alternativas"] == primera["alternativas"]


def test_pasaporte_explica_sin_inventar_cifras(cliente, condiciones):
    comparacion = cliente.post(f"{BASE}/comparaciones", json=condiciones).json()
    alt = comparacion["alternativas"][1]["alternativa_id"]
    r = cliente.get(f"{BASE}/comparaciones/{comparacion['comparacion_id']}/alternativas/{alt}/pasaporte")
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["explicacion"]["redactado_por"] == "plantilla"
    assert datos["explicacion"]["por_que_conviene"]
    assert datos["explicacion"]["que_se_sacrifica"]
    assert datos["explicacion"]["que_dato_cambiaria"]
    assert datos["comparacion_con_plan_habitual"]["margen_delta_soles_ha"] is not None
    assert datos["exportable"]["pdf_url"].endswith(f"alt={alt}")


def test_datos_y_supuestos_declara_procedencia(cliente, condiciones):
    comparacion = cliente.post(f"{BASE}/comparaciones", json=condiciones).json()
    datos = cliente.get(f"{BASE}/comparaciones/{comparacion['comparacion_id']}/datos-y-supuestos").json()
    assert any(f["dato"] == "clima diario" for f in datos["fuentes"])
    assert datos["versiones"]["semilla"] == 20261010
    assert len(datos["supuestos"]) >= 4


def test_el_area_guardada_viene_redondeada(cliente, parcela):
    """El area del pasaporte sale de la base, no de la respuesta de /parcelas."""
    assert parcela["area_ha"] == round(parcela["area_ha"], 2)
    from app.data.repository import REPO

    assert REPO.parcela(parcela["parcela_id"])["area_ha"] == parcela["area_ha"]


def test_la_respuesta_trae_los_alias_que_lee_el_frontend(cliente, condiciones):
    """El frontend normaliza en ingles: sin estos alias pinta ceros o se bloquea."""
    datos = cliente.post(f"{BASE}/comparaciones", json=condiciones).json()

    # status: la Vista 03 solo dibuja si es "ready". Con "listo" se queda esperando.
    assert datos["status"] == "ready"
    assert datos["estado"] == "listo", "el campo canonico no cambia"
    assert datos["prioridad"] in ("economia", "agua", "suelo")
    assert datos["area_ha"] > 0

    alt = datos["alternativas"][0]
    assert alt["tipo"] in ("economia", "agua", "suelo")
    assert set(alt["margen"]) >= {"mediana", "promedio", "adverso", "minimo", "maximo"}
    assert alt["agua"]["metrica"] == "deficit"
    assert alt["suelo"]["compatibilidad"]

    # Metricas por campania: lo que hace que el abanico de la Vista 03 cambie.
    for campana in alt["campanas"]:
        assert campana["metrics"] is not None, "campana sin desglose"
        assert campana["metrics"]["yield"]["unit"] == "t/ha"
        assert campana["metrics"]["economy"]["unit"] == "S/ha"


def test_guide_health_responde_sin_clave(cliente):
    """La Guia del frontend lo consulta antes de abrir el chat."""
    r = cliente.get(f"{BASE}/guide-health")
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["ready"] is True and cuerpo["model"]
