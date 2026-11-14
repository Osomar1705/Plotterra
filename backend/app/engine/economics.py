"""Margen por campana."""
from __future__ import annotations

from app.engine.contrato import FichaCultivo


def margen_soles_ha(cultivo: FichaCultivo, rend_t_ha: float, factor_precio: float) -> float:
    """Margen = precio mediano x factor x rendimiento en kg - costos de la campania.

    El margen puede ser negativo: una campania que no cubre sus costos es un
    resultado valido y la tarjeta debe poder mostrarlo.
    """
    precio = float(cultivo.precio_soles_kg["mediana"]) * float(factor_precio)
    ingreso = precio * float(rend_t_ha) * 1000.0
    return round(ingreso - cultivo.costo_total_soles_ha, 2)
