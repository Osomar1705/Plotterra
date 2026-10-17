"""Agregacion y seleccion de las tres alternativas. Responsable: Ronald."""
from __future__ import annotations

from typing import Any

from app.schemas.comparacion import Alternativa


def seleccionar(metricas_por_rotacion: list[dict[str, Any]], prioridad: str) -> tuple[list[Alternativa], int]:
    """Pendiente: bloque de Ronald, dia 5.

    Descarta las dominadas (peores o iguales que otra en margen, deficit y suelo
    a la vez). Del frente restante toma el mejor margen para Economia, el menor
    deficit para Agua y el mayor indice para Suelo. Si un mismo plan gana dos
    criterios, toma el segundo mejor del otro para no mostrar tarjetas repetidas.

    Devuelve (alternativas, dominadas_descartadas).
    """
    raise NotImplementedError("selector.seleccionar: bloque de Ronald")
