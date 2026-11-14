"""Genera datasets/variabilidad_rendimiento.json a partir del dataset de ML.

Entrada: congelado/datos_desarrollo.csv del paquete
FieldShift_Resultados_Enriquecido_20261101T030917177652Z.zip (estadistica
agricola MIDAGRI por distrito, anio y cultivo, campanias 2016-17 a 2023-24).

Salida, por cultivo:
- rendimiento_relativo: cuantiles de rendimiento / mediana del mismo distrito.
  Es la variacion entre anios de un distrito. Se calcula sobre promedios
  distritales, asi que SUBESTIMA la variacion de una chacra concreta.
- perdida_area: cuantiles de area_perdida / area_sembrada de la campania
  (heladas, plagas, granizo). Solo donde la fuente lo registra.
Los cultivos sin datos usan la distribucion conjunta de los que si tienen.

Uso: python scripts/variabilidad_rendimiento.py <datos_desarrollo.csv> > datasets/variabilidad_rendimiento.json
"""
from __future__ import annotations

import json
import sys

import pandas as pd

CUANTILES = [round(0.05 * i, 2) for i in range(1, 20)]  # 0.05 .. 0.95
PATRONES = {
    "papa": r"^PAPA",
    "quinua": r"^QUINUA$",
    "cebada": r"^CEBADA GRANO$",
    "avena": r"^AVENA FORRAJERA$",
    "haba": r"^HABA GRANO SECO$",
    "tarwi": r"TARHUI",
}
MIN_ANIOS = 3


def main(ruta: str) -> None:
    d = pd.read_csv(ruta, low_memory=False, dtype={"ubigeo": str})
    d = d[(d.elegible_benchmark == 1) & (d.rendimiento_t_ha > 0)]
    salida: dict = {
        "_meta": {
            "fuente": "MIDAGRI, estadistica agricola por distrito (campanias 2016-17 a 2023-24), "
            "via congelado/datos_desarrollo.csv del paquete de ML de FieldShift",
            "cuantiles": CUANTILES,
            "nota": "Variacion entre anios de promedios distritales: subestima la de una chacra.",
        },
        "cultivos": {},
    }
    conjunto_rel: list[float] = []
    for cultivo, patron in PATRONES.items():
        x = d[d.cultivo.str.upper().str.contains(patron, regex=True)].copy()
        x = x[x.groupby("ubigeo").anio_cosecha.transform("nunique") >= MIN_ANIOS]
        if x.empty:
            salida["cultivos"][cultivo] = {"filas": 0}
            continue
        x["rel"] = x.rendimiento_t_ha / x.groupby("ubigeo").rendimiento_t_ha.transform("median")
        perdida = (x.area_perdida_campana_ha / x.siembras_campana_ha).where(x.siembras_campana_ha > 0).dropna().clip(0, 1)
        conjunto_rel += x.rel.tolist()
        salida["cultivos"][cultivo] = {
            "filas": int(len(x)),
            "distritos": int(x.ubigeo.nunique()),
            "rendimiento_mediano_t_ha": round(float(x.rendimiento_t_ha.median()), 2),
            "rendimiento_relativo": [round(float(v), 3) for v in x.rel.quantile(CUANTILES)],
            "perdida_area": [round(float(v), 3) for v in perdida.quantile(CUANTILES)] if len(perdida) >= 10 else None,
        }
    salida["conjunto"] = {
        "rendimiento_relativo": [round(float(v), 3) for v in pd.Series(conjunto_rel).quantile(CUANTILES)],
    }
    json.dump(salida, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
