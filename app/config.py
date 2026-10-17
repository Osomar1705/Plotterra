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
    anthropic_api_key: str | None
    presupuesto_ms: int
    base_path: str = "/api/v1"

    @property
    def usa_mock(self) -> bool:
        return self.motor != "real"


def cargar_config() -> Config:
    db = Path(os.getenv("FIELDSHIFT_DB", RAIZ / "datos" / "fieldshift.sqlite3"))
    datasets = Path(os.getenv("FIELDSHIFT_DATASETS", RAIZ / "datasets"))
    return Config(
        db_path=db,
        datasets_dir=datasets,
        motor=os.getenv("FIELDSHIFT_MOTOR", "mock").strip().lower(),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY") or None,
        presupuesto_ms=int(os.getenv("FIELDSHIFT_PRESUPUESTO_MS", "8000")),
    )


CONFIG = cargar_config()
