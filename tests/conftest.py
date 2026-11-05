from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

os.environ.setdefault("FIELDSHIFT_MOTOR", "mock")
_TMP = Path(tempfile.mkdtemp(prefix="fieldshift-tests-"))
os.environ["FIELDSHIFT_DB"] = str(_TMP / "test.sqlite3")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

BASE = "/api/v1"


@pytest.fixture(scope="session")
def cliente():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def parcela(cliente):
    r = cliente.post(
        f"{BASE}/parcelas",
        json={
            "geometria": {
                "type": "Polygon",
                # Chacra de ejemplo del paquete datos-1.0, dentro de la superficie agricola de Ambo.
                "coordinates": [[[-76.1760, -10.1123], [-76.1746, -10.1123], [-76.1746, -10.1136], [-76.1760, -10.1136], [-76.1760, -10.1123]]],
            }
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def condiciones(parcela):
    from datetime import date

    hoy = date.today()
    inicio = date(hoy.year if (hoy.month, hoy.day) <= (11, 1) else hoy.year + 1, 11, 1)
    return {
        "parcela_id": parcela["parcela_id"],
        "fecha_inicio": inicio.isoformat(),
        "cultivo_anterior": "papa",
        "agua": {"modo": "riego_turnos", "lamina_mm_campania": 180, "confianza": "estimado"},
        "cultivos_permitidos": ["papa", "quinua", "cebada", "avena", "haba", "tarwi"],
        "cultivos_excluidos": [{"cultivo": "cebada", "motivo": "sin_comprador"}],
        "prioridad": "agua",
        "plan_habitual": ["papa", "papa", "cebada"],
        "horizonte_campanias": 3,
        "escenarios": {"n": 100, "semilla": 20261010},
    }
