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

    datasets = REPO.datasets_de("hco_0412")
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
