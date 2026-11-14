"""Rendimiento a partir de la respuesta al deficit.

Es el punto donde se enchufa el modelo de ML cuando exista: el equipo de ML
entrega predecir_rendimiento(cultivo, deficit_mm, clima, suelo) -> t/ha y aqui
se reemplaza el cuerpo de la funcion. Nada mas cambia.
"""
from __future__ import annotations

from app.engine.contrato import BalanceResultado, FichaCultivo


def rendimiento_t_ha(cultivo: FichaCultivo, balance: BalanceResultado) -> float:
    """(1 - Ya/Ym) = Ky x (1 - ETa/ETc), por etapa y multiplicativo.

    Multiplicativo y no sumado: un estres severo en floracion no se compensa
    con una etapa final holgada. Es el uso estandar de FAO-33 por etapas.
    """
    kys = {e.nombre: e.ky for e in cultivo.etapas}
    fraccion = 1.0
    for etapa in balance.por_etapa:
        if etapa.etc_mm <= 0:
            continue
        ky = float(kys.get(etapa.etapa, 1.0))
        estres = 1.0 - (etapa.eta_mm / etapa.etc_mm)
        fraccion *= max(0.0, 1.0 - ky * estres)
    return round(max(0.0, cultivo.rendimiento_ref_t_ha * fraccion), 3)
