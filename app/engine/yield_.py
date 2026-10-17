"""Rendimiento a partir de la respuesta al deficit. Responsable: Breyner.

Es el punto donde se enchufa el modelo de ML cuando exista: el equipo de ML
entrega predecir_rendimiento(cultivo, deficit_mm, clima, suelo) -> t/ha y aqui
se reemplaza el cuerpo de la funcion. Nada mas cambia.
"""
from __future__ import annotations

from app.engine.contrato import BalanceResultado, FichaCultivo


def rendimiento_t_ha(cultivo: FichaCultivo, balance: BalanceResultado) -> float:
    """Pendiente: bloque de Breyner, dia 4.

    (1 - Ya/Ym) = Ky x (1 - ETa/ETc), aplicado por etapa sobre el rendimiento
    de referencia local.
    """
    raise NotImplementedError("yield_.rendimiento_t_ha: bloque de Breyner")
