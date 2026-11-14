"""Despacha al motor real o al de ejemplo. Responsable: Osmar.

api/ importa solo de aqui. Asi el dia que runner.py exista, el cambio es una
variable de entorno y no una edicion en los endpoints.
"""
from __future__ import annotations

from app.config import CONFIG
from app.engine.contrato import Condiciones, Datasets, ResultadoMotor


def ejecutar_comparacion(condiciones: Condiciones, datasets: Datasets) -> ResultadoMotor:
    if CONFIG.usa_mock:
        from app.mocks.motor_ejemplo import ejecutar_comparacion as motor
    else:
        from app.engine.runner import ejecutar_comparacion as motor
    return motor(condiciones, datasets)


def fuente_resultado() -> str:
    return "mock" if CONFIG.usa_mock else "calculado"
