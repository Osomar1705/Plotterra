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


MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]


def _meses_texto(meses: list[int]) -> str:
    """[12, 1, 2, 3] -> "de diciembre a marzo"; meses sueltos -> "julio y septiembre"."""
    conjunto = sorted(set(meses))
    if not conjunto:
        return ""
    if len(conjunto) >= 3 and len(conjunto) < 12:
        # Buscar un bloque continuo que pueda cruzar diciembre-enero.
        for inicio in conjunto:
            bloque = [((inicio - 1 + k) % 12) + 1 for k in range(len(conjunto))]
            if set(bloque) == set(conjunto):
                return f"de {MESES[bloque[0] - 1]} a {MESES[bloque[-1] - 1]}"
    nombres = [MESES[m - 1] for m in conjunto]
    return nombres[0] if len(nombres) == 1 else ", ".join(nombres[:-1]) + " y " + nombres[-1]


class ContextoSatelital:
    """Verdor de las chacras de cada distrito (HLS) y estres de la vegetacion (ECOSTRESS).

    A diferencia de la serie de la chacra de ejemplo, esto ya esta calculado
    para los 84 distritos, asi que cualquier parcela de Huanuco tiene su
    contexto sin clave de Earthdata. Es el verdor de las chacras del distrito en
    un punto representativo, NO el de la parcela: la respuesta lo dice.
    Lo genera fieldshift_datos/scripts/verdor_estres_backend.py.
    """

    def __init__(self, directorio: Path) -> None:
        self.directorio = Path(directorio)
        self._cargado = False
        self.verdor: dict[str, Any] = {}
        self.meta_verdor: dict[str, Any] = {}
        self.estres: dict[str, Any] | None = None

    def _cargar(self) -> None:
        if self._cargado:
            return
        self._cargado = True
        v = self.directorio / "verdor_distritos.json"
        if v.exists():
            datos = json.loads(v.read_text(encoding="utf-8"))
            self.verdor = datos.get("distritos", {})
            self.meta_verdor = datos.get("_meta", {})
        e = self.directorio / "ecostress_ambo.json"
        if e.exists():
            self.estres = json.loads(e.read_text(encoding="utf-8"))

    def distrito(self, celda_id: str | None) -> dict[str, Any] | None:
        self._cargar()
        d = self.verdor.get(str(celda_id)) if celda_id else None
        if d is None:
            return None
        verdes, secos = d["meses_verdes"], d["meses_mas_secos"]
        return {
            "nivel": "distrito",
            "celda_id": str(celda_id),
            "distrito": d["distrito"],
            "mensaje_agricultor": (
                f"En las chacras de {d['distrito'].title()} el satelite ve el campo mas verde en "
                f"{_meses_texto(sorted(verdes))} y mas seco en {_meses_texto(sorted(secos))}. "
                "Es el distrito, no tu parcela exacta."
            ),
            "ciclo_tipico": d["ciclo_tipico"],
            "amplitud_ciclo": d["amplitud_ciclo"],
            "mes_mas_verde": d["mes_mas_verde"],
            "mes_mas_seco": d["mes_mas_seco"],
            "meses_verdes": verdes,
            "meses_mas_secos": secos,
            "ndvi_epoca_seca_jul_sep": d["ndvi_epoca_seca_jul_sep"],
            "campanas": d["campanas"],
            "imagenes_despejadas": d["imagenes_despejadas"],
            "escenas_revisadas": d["escenas_revisadas"],
            "desde": d["desde"],
            "hasta": d["hasta"],
            "sitio": d["sitio"],
            "fuente": self.meta_verdor.get("fuente", ""),
            "alcance": self.meta_verdor.get("alcance", ""),
        }

    def estres_vegetacion(self, celda_id: str | None) -> dict[str, Any] | None:
        """ESI de ECOSTRESS. Solo hay sitios medidos en Ambo: fuera de ahi, None."""
        self._cargar()
        e = self.estres
        if not e or str(celda_id) not in e["_meta"].get("ubigeos", []):
            return None
        peores = e["meses_con_mas_estres"]
        return {
            "nivel": "distrito",
            "indicador": "ESI",
            "mensaje_agricultor": (
                f"Desde el espacio, las plantas de las chacras de Ambo muestran mas falta de agua en "
                f"{_meses_texto(sorted(peores))}: es la epoca seca."
            ),
            "lectura": e["_meta"]["lectura"],
            "por_mes": e["por_mes"],
            "meses_con_mas_estres": peores,
            "meses_sin_datos": e["meses_sin_datos"],
            "sitios": e["sitios"],
            "observaciones": e["observaciones"],
            "desde": e["desde"],
            "hasta": e["hasta"],
            "fuente": e["_meta"]["fuente"],
            "alcance": e["_meta"]["alcance"],
        }

    def para(self, celda_id: str | None) -> dict[str, Any]:
        """Bloques que se suman a la respuesta de verdor, solo si hay datos."""
        extra: dict[str, Any] = {}
        d = self.distrito(celda_id)
        if d is not None:
            extra["verdor_distrito"] = d
        s = self.estres_vegetacion(celda_id)
        if s is not None:
            extra["estres_vegetacion"] = s
        return extra


class SerieVerdor:
    """La serie medida de la chacra de ejemplo. Se lee una vez."""

    def __init__(self, directorio: Path) -> None:
        self.contexto = ContextoSatelital(directorio)
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

    def para(self, geometria: dict[str, Any] | None, celda_id: str | None = None) -> dict[str, Any]:
        """Verificacion de la parcela + contexto satelital del distrito.

        `disponible` sigue hablando solo de la parcela: si cae lejos del punto
        medido es False, aunque el distrito si tenga verdor y estres.
        """
        return {**self._para_parcela(geometria), **self.contexto.para(celda_id)}

    def _para_parcela(self, geometria: dict[str, Any] | None) -> dict[str, Any]:
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
