"""Clave de cache de una ejecucion.

La clave es un hash de la geometria de la parcela, las condiciones, el conjunto
de escenarios y la version del motor. Si la clave existe, la respuesta sale de
disco en lugar de recalcular. Esto es lo que vuelve instantaneo el ir y venir
entre la comparacion y el pasaporte durante la grabacion del video, y lo que
permite preparar la demo con el resultado ya caliente.

La version del motor entra en la clave a proposito: si se corrige un parametro
agronomico a mitad de semana, los resultados viejos no se sirven como nuevos.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any


def clave_cache(
    *,
    geometria: dict[str, Any] | None,
    area_ha: float,
    condiciones: dict[str, Any],
    cambios: list[dict[str, Any]],
    version_motor: str,
    version_datasets: str,
) -> str:
    material = {
        "geometria": geometria,
        "area_ha": round(float(area_ha), 4),
        "condiciones": condiciones,
        "cambios": cambios,
        "version_motor": version_motor,
        "version_datasets": version_datasets,
    }
    crudo = json.dumps(material, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(crudo.encode("utf-8")).hexdigest()
