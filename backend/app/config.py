"""Configuracion por variables de entorno. Sin secretos en el repositorio."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Config:
    db_path: Path
    datasets_dir: Path
    motor: str
    openai_api_key: str | None
    modelo_llm: str
    presupuesto_ms: int
    base_path: str = "/api/v1"

    @property
    def usa_mock(self) -> bool:
        return self.motor != "real"


def limpiar_clave(cruda: str | None) -> str | None:
    """Quita lo que se suele pegar junto con la clave en el panel de Render.

    Espacios o saltos de linea al final, comillas, o la linea entera del .env
    ("OPENAI_API_KEY=sk-..."). Cualquiera de esos hace que la API
    responda 401 y el chat caiga a reglas sin que nadie lo note.
    """
    if not cruda:
        return None
    clave = cruda.strip()
    if clave.upper().startswith("OPENAI_API_KEY="):
        clave = clave.split("=", 1)[1].strip()
    if clave.lower().startswith("bearer "):
        clave = clave[7:].strip()
    clave = clave.strip("\"'` ")
    return clave or None


def cargar_config() -> Config:
    db = Path(os.getenv("FIELDSHIFT_DB", RAIZ / "datos" / "fieldshift.sqlite3"))
    datasets = Path(os.getenv("FIELDSHIFT_DATASETS", RAIZ / "datasets"))
    return Config(
        db_path=db,
        datasets_dir=datasets,
        motor=os.getenv("FIELDSHIFT_MOTOR", "mock").strip().lower(),
        openai_api_key=limpiar_clave(os.getenv("OPENAI_API_KEY")),
        modelo_llm=(os.getenv("FIELDSHIFT_MODELO_LLM") or "gpt-4.1-mini").strip(),
        presupuesto_ms=int(os.getenv("FIELDSHIFT_PRESUPUESTO_MS", "20000")),
    )


CONFIG = cargar_config()
