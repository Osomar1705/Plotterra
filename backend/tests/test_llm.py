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
    nueva = dataclasses.replace(CONFIG, openai_api_key=valor)
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


# --- Cliente OpenAI con HTTP simulado: nunca toca la red -------------------
import json
import httpx
from app.config import limpiar_clave


def _cliente_simulado(monkeypatch, status, cuerpo):
    _clave(monkeypatch, "sk-test")
    real_client = httpx.Client
    def fake_client(*args, **kwargs):
        def response(request):
            assert request.url.path == "/v1/responses"
            assert request.headers["Authorization"] == "Bearer sk-test"
            return httpx.Response(status, json=cuerpo)
        return real_client(transport=httpx.MockTransport(response))
    monkeypatch.setattr(cliente_mod.httpx, "Client", fake_client)
    monkeypatch.setattr(cliente_mod, "_ultimo_error", None)
    monkeypatch.setattr(cliente_mod, "_ultima_prueba", None)


def test_clave_invalida_queda_registrada_con_pista(monkeypatch):
    _cliente_simulado(monkeypatch, 401, {"error": {"type": "authentication_error", "message": "Invalid API key"}})
    interpretacion, quien = intent_mod.interpretar("quiero 30% menos riego", CATALOGO)
    assert quien == "reglas" and interpretacion is not None
    err = cliente_mod.ultimo_error()
    assert err["status"] == 401 and "authentication_error" in err["detalle"]
    assert "OPENAI_API_KEY" in err["pista"]
    assert "sk-test" not in json.dumps(err)


def test_sin_saldo_se_explica(monkeypatch):
    _cliente_simulado(monkeypatch, 429, {"error": {"code": "insufficient_quota", "message": "You exceeded your quota"}})
    resultado = cliente_mod.probar()
    assert resultado["ok"] is False and "saldo" in resultado["error"]["pista"]
    assert cliente_mod.probar()["en_cache"] is True


def test_respuesta_valida_del_modelo_real_se_usa(monkeypatch):
    salida = {"intent": "ajustar_precio", "factor": 0.75, "cultivo": None, "campania": None,
              "prioridad": None, "descripcion": "Bajar los precios 25 % y comparar", "confianza": 0.9}
    _cliente_simulado(monkeypatch, 200, {"status": "completed", "model": "gpt-4.1-mini",
        "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps(salida)}]}]})
    interpretacion, quien = intent_mod.interpretar("y si el precio cae 25%?", CATALOGO)
    assert quien == "llm"
    assert interpretacion.intent is Intent.ajustar_precio and interpretacion.parametros == {"factor": 0.75}
    assert cliente_mod.ultimo_error() is None


def test_limpiar_clave_quita_lo_que_se_pega_de_mas():
    assert limpiar_clave('  "sk-abc"\n') == "sk-abc"
    assert limpiar_clave("OPENAI_API_KEY=sk-abc") == "sk-abc"
    assert limpiar_clave("Bearer sk-abc") == "sk-abc"
    assert limpiar_clave("   ") is None and limpiar_clave(None) is None


def test_si_el_modelo_configurado_falla_se_usa_el_de_respaldo(monkeypatch):
    from types import SimpleNamespace
    from app.llm import cliente
    from app.llm.cliente import OpenAIResponseError

    monkeypatch.setattr(cliente, "CONFIG", SimpleNamespace(openai_api_key="sk-test", modelo_llm="modelo-que-no-existe", presupuesto_ms=5000))
    monkeypatch.setattr(cliente, "_modelo_activo", None)
    usados = []

    def falso(modelo, **_):
        usados.append(modelo)
        if modelo == "modelo-que-no-existe":
            raise OpenAIResponseError(404, "model_not_found")
        return {"status": "completed", "model": modelo,
                "output": [{"type": "message", "content": [{"type": "output_text", "text": "ok"}]}]}

    monkeypatch.setattr(cliente, "_solicitar_modelo", falso)
    raw = cliente._solicitar(instrucciones="x", entrada="y", max_tokens=10)
    assert raw["model"] == "gpt-4.1-mini" and usados[0] == "modelo-que-no-existe"
