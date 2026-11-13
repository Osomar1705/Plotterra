"""Verdor (NDVI) de una parcela, a partir de imagenes de satelite.

Hoy solo existe la serie de la chacra de ejemplo de Ambo: 2015-2026, NASA HLS
(Landsat 8/9 + Sentinel-2, 30 m), ya calculada en datasets/parcela_demo/.
Calcular el verdor de cualquier parcela dibujada exige descargar imagenes con
una clave de NASA Earthdata y tarda unos dos minutos: eso queda fuera de esta
version, y la respuesta lo dice en lugar de inventar una serie.

Para que la verificacion sea honesta, el verdor solo se entrega cuando la
parcela cae sobre el punto medido.
"""
from __future__ import annotations

import csv
import json
import math
import statistics
from datetime import date, timedelta
from pathlib import Path
from typing import Any

# Distancia maxima entre el centro de la parcela y el punto medido. El NDVI es
# la mediana de 3x3 pixeles de 30 m: mas lejos, ya es otro terreno.
RADIO_MEDIDO_M = 300.0

# Reglas del verificador de parcela del paquete datos-1.0.
AMPLITUD_CICLO = 0.20
TECHO_SIN_VEGETACION = 0.30
PISO_SIEMPRE_VERDE = 0.60


def _distancia_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6_371_008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def centro(geometria: dict[str, Any] | None) -> tuple[float, float] | None:
    if not geometria:
        return None
    anillo = geometria["coordinates"][0]
    if len(anillo) > 1 and anillo[0] == anillo[-1]:
        anillo = anillo[:-1]
    return sum(p[0] for p in anillo) / len(anillo), sum(p[1] for p in anillo) / len(anillo)


def clasificar(valores: list[float]) -> tuple[str, str]:
    """(patron, mensaje para el agricultor) a partir del NDVI de un periodo."""
    if len(valores) < 4:
        return "dudoso", "Hay muy pocas imagenes despejadas para decir que crece en tu terreno."
    ordenados = sorted(valores)
    p10 = ordenados[int(0.1 * (len(ordenados) - 1))]
    p90 = ordenados[int(0.9 * (len(ordenados) - 1))]
    if max(valores) < TECHO_SIN_VEGETACION:
        return "sin_vegetacion", "El satelite casi no ve plantas en tu terreno: puede ser ciudad, roca o suelo desnudo."
    if p10 > PISO_SIEMPRE_VERDE:
        return "vegetacion_permanente", "Tu terreno se ve verde todo el anio, como monte o bosque, no como una chacra."
    if p90 - p10 > AMPLITUD_CICLO:
        return (
            "ciclo_de_cultivo",
            "Tu terreno es una zona de cultivo: el satelite ve el verdor subir con cada siembra y bajar con la cosecha.",
        )
    return "dudoso", "El verdor de tu terreno cambia poco: no podemos confirmar que sea una chacra."


class SerieVerdor:
    """La serie medida de la chacra de ejemplo. Se lee una vez."""

    def __init__(self, directorio: Path) -> None:
        self.directorio = Path(directorio) / "parcela_demo"
        self._cargada = False
        self.punto: tuple[float, float] | None = None
        self.altura_m: float | None = None
        self.fuente = ""
        self.serie: list[dict[str, Any]] = []
        self.campanas: list[dict[str, Any]] = []

    def _cargar(self) -> None:
        if self._cargada:
            return
        self._cargada = True
        ficha = self.directorio / "ficha.json"
        serie = self.directorio / "ndvi_serie.csv"
        if not (ficha.exists() and serie.exists()):
            return
        f = json.loads(ficha.read_text(encoding="utf-8"))
        self.punto = (float(f["lon"]), float(f["lat"]))
        self.altura_m = f.get("altura_m")
        with serie.open(encoding="utf-8-sig") as fh:
            for fila in csv.DictReader(fh):
                if not fila["ndvi"]:
                    continue  # imagen con nubes: no se descarta en silencio, se cuenta
                self.fuente = fila["fuente"]
                self.serie.append(
                    {"fecha": fila["fecha"], "ndvi": round(float(fila["ndvi"]), 3), "sensor": fila["sensor"]}
                )
        self.serie.sort(key=lambda x: x["fecha"])
        self._total_escenas = sum(1 for _ in serie.open(encoding="utf-8-sig")) - 1
        campanas = self.directorio / "ndvi_campanas.csv"
        if campanas.exists():
            with campanas.open(encoding="utf-8-sig") as fh:
                for fila in csv.DictReader(fh):
                    self.campanas.append(
                        {
                            "campana": fila["campana"],
                            "fecha_pico": fila["fecha_pico"],
                            "ndvi_pico": round(float(fila["ndvi_max"]), 3),
                            "imagenes": int(fila["imagenes"]),
                        }
                    )

    def para(self, geometria: dict[str, Any] | None) -> dict[str, Any]:
        self._cargar()
        c = centro(geometria)
        if self.punto is None or not self.serie:
            return self._no_disponible("sin_datos", "Todavia no hay imagenes de satelite preparadas.")
        if c is None:
            return self._no_disponible(
                "sin_dibujo",
                "Para ver el verdor necesitamos el contorno de tu chacra en el mapa.",
            )
        distancia = _distancia_m(c[0], c[1], *self.punto)
        if distancia > RADIO_MEDIDO_M:
            return self._no_disponible(
                "fuera_del_punto_medido",
                "Por ahora solo tenemos el verdor medido de la chacra de ejemplo de Ambo. "
                "Para tu parcela hay que descargar imagenes de satelite, y eso aun no esta activo.",
                distancia_m=round(distancia),
            )

        ultima = date.fromisoformat(self.serie[-1]["fecha"])
        ultimo_anio = [p["ndvi"] for p in self.serie if date.fromisoformat(p["fecha"]) > ultima - timedelta(days=365)]
        patron, mensaje = clasificar(ultimo_anio)
        por_mes: dict[int, list[float]] = {}
        for p in self.serie:
            por_mes.setdefault(int(p["fecha"][5:7]), []).append(p["ndvi"])
        return {
            "disponible": True,
            "patron": patron,
            "mensaje_agricultor": mensaje,
            "distancia_al_punto_medido_m": round(distancia),
            "punto_medido": {"lon": self.punto[0], "lat": self.punto[1], "altura_m": self.altura_m},
            "ultimos_12_meses": {
                "imagenes": len(ultimo_anio),
                "ndvi_min": round(min(ultimo_anio), 3) if ultimo_anio else None,
                "ndvi_max": round(max(ultimo_anio), 3) if ultimo_anio else None,
            },
            "ciclo_tipico": [
                {"mes": m, "ndvi_medio": round(statistics.fmean(v), 3)} for m, v in sorted(por_mes.items())
            ],
            "campanas": self.campanas,
            "serie": self.serie,
            "imagenes_despejadas": len(self.serie),
            "escenas_revisadas": self._total_escenas,
            "fuente": self.fuente,
        }

    def _no_disponible(self, motivo: str, mensaje: str, **extra: Any) -> dict[str, Any]:
        return {"disponible": False, "motivo": motivo, "mensaje_agricultor": mensaje, **extra}
