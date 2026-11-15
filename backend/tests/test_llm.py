"""El chatbot nunca deja al agricultor sin salida.

Estas pruebas no llaman a la API: sustituyen app.llm.cliente.responder, que es
la unica puerta de salida a la red.
"""
from __future__ import annotations

import dataclasses
from datetime import date

import app.llm.cliente as cliente_mod
import app.llm.explain as explain
import app.llm.intent as intent_mod
from app.config import CONFIG
from app.schemas.consultas import Intent

CATALOGO = {"papa", "quinua", "haba", "cebada"}


def _clave(monkeypatch, valor):
    """Config es un dataclass congelado: se reemplaza entero en cada modulo."""
    nueva = dataclasses.replace(CONFIG, anthropic_api_key=valor)
    for mod in (cliente_mod, explain, intent_mod):
        monkeypatch.setattr(mod, "CONFIG", nueva)


def test_sin_clave_responde_por_reglas(monkeypatch):
    _clave(monkeypatch, None)
    interpretacion, quien = intent_mod.interpretar("quiero 30% menos riego", CATALOGO)
    assert quien == "reglas"
    assert interpretacion is not None
    assert interpretacion.intent is Intent.ajustar_riego
    assert interpretacion.parametros["factor"] == 0.7


def test_api_caida_cae_a_reglas(monkeypatch):
    _clave(monkeypatch, "sk-falsa")

    def explota(**kwargs):
        raise RuntimeError("502 desde la API")

    monkeypatch.setattr(cliente_mod, "responder", explota)
    interpretacion, quien = intent_mod.interpretar("quiero 30% menos riego", CATALOGO)
    assert quien == "reglas"
    assert interpretacion is not None
    assert interpretacion.parametros["factor"] == 0.7


def test_parametros_invalidos_del_modelo_se_rechazan(monkeypatch):
    """Un factor de riego imposible no puede llegar al motor."""
    _clave(monkeypatch, "sk-falsa")

    def devuelve_basura(**kwargs):
        return intent_mod._SalidaLLM(
            intent=Intent.ajustar_riego,
            factor=9.9,  # fuera del rango 0.1-1.5
            descripcion="Regar nueve veces mas",
            confianza=0.99,
        )

    monkeypatch.setattr(cliente_mod, "responder", devuelve_basura)
    interpretacion, quien = intent_mod.interpretar("riego x9", CATALOGO)
    assert quien == "reglas", "los parametros invalidos del LLM deben caer a reglas"


def test_cultivo_fuera_del_catalogo_se_rechaza(monkeypatch):
    _clave(monkeypatch, "sk-falsa")

    def inventa_cultivo(**kwargs):
        return intent_mod._SalidaLLM(
            intent=Intent.excluir_cultivo,
            cultivo="mango",  # no esta en el catalogo
            descripcion="Sacar el mango",
            confianza=0.9,
        )

    monkeypatch.setattr(cliente_mod, "responder", inventa_cultivo)
    _, quien = intent_mod.interpretar("saca el mango", CATALOGO)
    assert quien == "reglas"


def test_interpretacion_valida_del_modelo_se_acepta(monkeypatch):
    _clave(monkeypatch, "sk-falsa")

    def buena(**kwargs):
        return intent_mod._SalidaLLM(
            intent=Intent.cambiar_prioridad,
            prioridad="suelo",
            descripcion="Priorizar el cuidado del suelo y volver a comparar",
            confianza=0.82,
        )

    monkeypatch.setattr(cliente_mod, "responder", buena)
    interpretacion, quien = intent_mod.interpretar("lo que mas me importa es la tierra", CATALOGO)
    assert quien == "llm"
    assert interpretacion is not None
    assert interpretacion.parametros["prioridad"] == "suelo"
    assert interpretacion.etiqueta, "la etiqueta la calcula etiqueta_de, no el modelo"


def test_pasaporte_cae_a_plantilla_si_falla_el_llm(cliente, monkeypatch):
    """El pasaporte sigue siendo utilizable sin LLM."""
    _clave(monkeypatch, None)
    from app.data.repository import REPO
    from app.engine.contrato import Condiciones
    from app.mocks.motor_ejemplo import ejecutar_comparacion

    datasets = REPO.datasets_de("100201")
    cond = Condiciones(
        parcela_id="p_prueba",
        area_ha=1.0,
        fecha_inicio=date(2026, 11, 1),
        cultivo_anterior=None,
        modo_agua="secano",
        lamina_mm_campania=0.0,
        cultivos_permitidos=sorted(CATALOGO & set(datasets.fichas)),
        prioridad="agua",
        plan_habitual=None,
        cultivos_fijados={},
        horizonte_campanias=1,
        n_escenarios=10,
        semilla=7,
    )
    alternativa = ejecutar_comparacion(cond, datasets).alternativas[0]
    exp = explain.redactar(alternativa)
    assert exp.redactado_por == "plantilla"
    assert exp.por_que_conviene


def test_entiende_las_preguntas_de_lluvia_y_precio(monkeypatch):
    """Las dos preguntas nuevas, sin LLM: tienen que salir por reglas."""
    _clave(monkeypatch, None)
    casos = [
        ("y si llueve menos?", Intent.ajustar_lluvia),
        ("y si llueve 40% menos", Intent.ajustar_lluvia),
        ("va a ser un ano seco", Intent.ajustar_lluvia),
        ("y si baja el precio un 25%", Intent.ajustar_precio),
        ("y si tengo 30% menos riego?", Intent.ajustar_riego),
    ]
    for texto, esperado in casos:
        interpretacion, quien = intent_mod.interpretar(texto, CATALOGO)
        assert interpretacion is not None, f"no entendio: {texto}"
        assert interpretacion.intent is esperado, f"{texto} -> {interpretacion.intent}"
        assert quien == "reglas"


def test_la_lluvia_no_se_confunde_con_el_riego(monkeypatch):
    """"Llueve menos" habla de agua pero no es lo mismo que regar menos."""
    _clave(monkeypatch, None)
    lluvia, _ = intent_mod.interpretar("y si llueve 30% menos", CATALOGO)
    riego, _ = intent_mod.interpretar("y si riego 30% menos", CATALOGO)
    assert lluvia.intent is Intent.ajustar_lluvia
    assert riego.intent is Intent.ajustar_riego


def test_el_interprete_por_reglas_entiende_ingles():
    """El frontend v9 esta en ingles y en el deploy no hay clave de LLM."""
    from app.llm.intent import interpretar_por_reglas
    from app.schemas.consultas import Intent

    cat = {"papa", "quinua", "cebada", "avena", "haba", "tarwi"}
    casos = {
        "What if I have 30% less irrigation?": (Intent.ajustar_riego, {"factor": 0.7}),
        "what if it rains 20% less": (Intent.ajustar_lluvia, {"factor": 0.8}),
        "what if prices drop 15%": (Intent.ajustar_precio, {"factor": 0.85}),
        "I can't sell barley": (Intent.excluir_cultivo, {"cultivo": "cebada", "motivo": "sin_comprador"}),
        "I want potato in the first season": (Intent.fijar_cultivo_campania, {"cultivo": "papa", "campania": 1}),
        "I prefer to care about the soil": (Intent.cambiar_prioridad, {"prioridad": "suelo"}),
    }
    for texto, (intent, parametros) in casos.items():
        r = interpretar_por_reglas(texto, cat)
        assert r is not None and r.intent is intent and r.parametros == parametros, texto
        assert not any(c in r.descripcion for c in "áéíóúñ") and "compare" in r.descripcion.lower(), texto
    # El espanol sigue igual.
    assert interpretar_por_reglas("no puedo vender cebada", cat).descripcion.startswith("Quitar")


def test_consulta_en_ingles_no_entendida_responde_en_ingles(cliente, condiciones):
    from tests.conftest import BASE

    cmp_id = cliente.post(f"{BASE}/comparaciones", json=condiciones).json()["comparacion_id"]
    r = cliente.post(f"{BASE}/consultas", json={"comparison_id": cmp_id, "message": "hello there"}).json()
    assert r["status"] == "needs_clarification"
    assert r["mensaje"].startswith("We did not understand") and r["sugerencias"][0].startswith("What if")
