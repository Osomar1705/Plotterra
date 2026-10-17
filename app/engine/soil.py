"""Indice de compatibilidad agronomica de la secuencia. Responsable: Breyner.

El indice expresa compatibilidad de la rotacion, NO un cambio medido de
fertilidad. Devuelve siempre su razon principal para que la interfaz no pueda
presentarlo como una prediccion de fertilidad futura.
"""
from __future__ import annotations

from app.engine.contrato import FichaCultivo


def indice_suelo(secuencia: list[str], fichas: dict[str, FichaCultivo]) -> tuple[float, str]:
    """Pendiente: bloque de Breyner, dia 4.

    Ponderacion acordada: diversidad de familias 0.40, presencia de leguminosa
    0.30, cobertura del suelo 0.20, restricciones sanitarias 0.10.
    """
    raise NotImplementedError("soil.indice_suelo: bloque de Breyner")
