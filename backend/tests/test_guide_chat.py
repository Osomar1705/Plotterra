"""Pruebas de integración sin credenciales reales ni llamadas externas."""
from app.config import CONFIG


def test_guide_chat_explanation_without_comparison(cliente, monkeypatch):
    monkeypatch.setattr("app.api.routes_guide_chat.CONFIG", CONFIG.__class__(**{**CONFIG.__dict__, "openai_api_key": None}))
    response = cliente.post("/api/v1/guide-chat", json={"message": "Explain the three options in simple words.",
                                                       "conversation_id": "session-1", "context": {"page": "parcel"}})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "answered" and body["message"] and body["conversation_id"] == "session-1"


def test_guide_chat_proposes_but_does_not_apply(cliente):
    response = cliente.post("/api/v1/guide-chat", json={"message": "What if I have 30% less irrigation?",
                                                       "conversation_id": "session-2", "context": {"page": "comparison"}})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "proposed_change"
    assert body["change"]["type"] == "irrigation"
    assert body["change"]["value"] == 30


def test_guide_chat_explains_supplied_results(cliente, monkeypatch):
    monkeypatch.setattr("app.api.routes_guide_chat.CONFIG", CONFIG.__class__(**{**CONFIG.__dict__, "openai_api_key": None}))
    response = cliente.post("/api/v1/guide-chat", json={"message": "Which plan is safer?", "context": {
        "comparison": {"alternatives": [{"type": "economy", "margin": {"min": 100, "max": 200}},
                                         {"type": "water", "margin": {"min": 80, "max": 190}},
                                         {"type": "soil", "margin": {"min": 90, "max": 195}}]}}})
    assert response.status_code == 200
    assert response.json()["status"] == "answered"
