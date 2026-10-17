"""Margen por campana. Responsable: Breyner."""
from __future__ import annotations

from app.engine.contrato import FichaCultivo


def margen_soles_ha(cultivo: FichaCultivo, rend_t_ha: float, factor_precio: float) -> float:
    """Pendiente: bloque de Breyner, dia 4.

    Margen = precio mediano x factor_precio x rendimiento en kg - costos de la
    campana. La moneda y la superficie viajan explicitas en el nombre.
    """
    raise NotImplementedError("economics.margen_soles_ha: bloque de Breyner")
