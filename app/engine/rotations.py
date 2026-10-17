"""Rotaciones candidatas y sus motivos de descarte. Responsable: Ronald.

Cada descarte guarda su motivo: es lo que despues permite explicar al agricultor
por que solo hay dos opciones.
"""
from __future__ import annotations

from app.engine.contrato import Condiciones, Datasets


def generar_rotaciones(condiciones: Condiciones, datasets: Datasets) -> tuple[list[list[str]], dict[str, int]]:
    """Pendiente: bloque de Ronald, dia 5.

    Devuelve (rotaciones_validas, motivos_de_descarte). Se descartan las que
    repiten familia en campanias consecutivas, las que no entran en la ventana
    de siembra, las que incluyen cultivos excluidos y las que chocan con el
    cultivo anterior.
    """
    raise NotImplementedError("rotations.generar_rotaciones: bloque de Ronald")
