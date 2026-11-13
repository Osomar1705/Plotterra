"""Las celdas son distritos del INEI, identificados por su ubigeo.

Sustituye la celda unica hco_0412 por los 84 distritos de Huanuco que trae el
paquete datos-1.0. Todo el clima y el suelo estan calculados solo sobre la
superficie agricola de cada distrito, no sobre cerros y puna.
"""
from __future__ import annotations

import csv
import json
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.engine.contrato import Suelo

# Profundidad del resumen de suelo que publica el paquete.
PROFUNDIDAD_SUELO_CM = 30


def _punto_en_anillo(lon: float, lat: float, anillo: list[list[float]]) -> bool:
    """Algoritmo del rayo. El anillo viene como [[lon, lat], ...]."""
    dentro = False
    n = len(anillo)
    for i in range(n):
        x1, y1 = anillo[i][0], anillo[i][1]
        x2, y2 = anillo[(i + 1) % n][0], anillo[(i + 1) % n][1]
        if (y1 > lat) != (y2 > lat):
            corte = x1 + (lat - y1) * (x2 - x1) / (y2 - y1)
            if lon < corte:
                dentro = not dentro
    return dentro


def _punto_en_geometria(lon: float, lat: float, geom: dict[str, Any]) -> bool:
    poligonos = (
        [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    )
    for poli in poligonos:
        if not poli:
            continue
        if _punto_en_anillo(lon, lat, poli[0]):
            # Los anillos siguientes son huecos.
            if not any(_punto_en_anillo(lon, lat, hueco) for hueco in poli[1:]):
                return True
    return False


def _sin_tildes(texto: str) -> str:
    plano = unicodedata.normalize("NFD", texto.strip().lower())
    return "".join(c for c in plano if unicodedata.category(c) != "Mn")


def _texto_textura(arena: float, arcilla: float) -> str:
    """Nombre de la clase textural, suficiente para mostrarlo al agricultor."""
    if arcilla >= 40:
        return "arcilloso"
    if arena >= 70:
        return "arenoso"
    if arcilla >= 27:
        return "franco arcilloso"
    if arena >= 52:
        return "franco arenoso"
    return "franco"


class CatalogoCeldas:
    """Celdas distritales con su suelo. El clima se carga aparte y por demanda."""

    def __init__(self, directorio: Path) -> None:
        self.directorio = Path(directorio)
        self._celdas: dict[str, dict[str, Any]] = {}
        self._geometrias: dict[str, dict[str, Any]] = {}
        self._suelos: dict[str, Suelo] = {}
        self._chirps: dict[tuple[str, str], float] | None = None
        self.version: str = "desconocida"
        self.provisional: bool = True

    @property
    def disponible(self) -> bool:
        return bool(self._celdas)

    def cargar(self) -> bool:
        """True si el paquete distrital esta presente. False deja el modo anterior."""
        geo = self.directorio / "celdas_distritos.geojson"
        suelo = self.directorio / "suelo_distritos.csv"
        if not (geo.exists() and suelo.exists()):
            return False

        version = self.directorio / "version_datos.json"
        if version.exists():
            v = json.loads(version.read_text(encoding="utf-8"))
            self.version = v.get("version_datos", self.version)
            self.provisional = bool(v.get("provisional", True))

        with suelo.open(encoding="utf-8-sig") as fh:
            filas = {f["ubigeo"]: f for f in csv.DictReader(fh)}

        datos = json.loads(geo.read_text(encoding="utf-8"))
        for rasgo in datos["features"]:
            p = rasgo["properties"]
            ubigeo = str(p["ubigeo"])
            fila = filas.get(ubigeo)
            if fila is None:
                continue
            self._geometrias[ubigeo] = rasgo["geometry"]
            self._celdas[ubigeo] = {
                "celda_id": ubigeo,
                "localidad": p["distrito"].title(),
                "provincia": p["provincia"].title(),
                "area_agricola_ha": float(p.get("area_agricola_ha") or 0.0),
                "altura_chacras_m": float(p.get("altura_chacras_m") or 0.0),
                "fuente_clima": "ET0 y dias de lluvia de NASA POWER; lluvia mensual de CHIRPS",
            }
            self._suelos[ubigeo] = self._suelo_de(ubigeo, fila)
        return self.disponible

    def _suelo_de(self, ubigeo: str, fila: dict[str, str]) -> Suelo:
        arena = float(fila["arena_pct"])
        arcilla = float(fila["arcilla_pct"])
        mm = PROFUNDIDAD_SUELO_CM * 10  # cm -> mm de perfil
        return Suelo(
            celda_id=ubigeo,
            textura=_texto_textura(arena, arcilla),
            capacidad_campo_mm=round(float(fila["agua_capacidad_campo_pct"]) / 100 * mm, 1),
            punto_marchitez_mm=round(float(fila["agua_punto_marchitez_pct"]) / 100 * mm, 1),
            profundidad_cm=PROFUNDIDAD_SUELO_CM,
            materia_organica_pct=round(float(fila["carbono_org_g_kg"]) / 10 * 1.724, 2),
            fuente=fila.get("fuente", "ISRIC SoilGrids 2.0 sobre superficie agricola"),
            incertidumbre="baja" if fila.get("provisional", "").lower() == "false" else "media",
            provisional=fila.get("provisional", "True").lower() != "false",
        )

    # ------------------------------------------------------------------ consulta
    def celdas(self) -> list[dict[str, Any]]:
        return list(self._celdas.values())

    def celda(self, celda_id: str) -> dict[str, Any] | None:
        return self._celdas.get(str(celda_id))

    def suelo(self, celda_id: str) -> Suelo | None:
        return self._suelos.get(str(celda_id))

    def por_punto(self, lon: float, lat: float) -> dict[str, Any] | None:
        for ubigeo, geom in self._geometrias.items():
            if _punto_en_geometria(lon, lat, geom):
                return self._celdas[ubigeo]
        return None

    def por_localidad(self, localidad: str | None) -> dict[str, Any] | None:
        """Busca el distrito tolerando tildes, mayusculas y sufijos.

        El frontend manda cosas como "Huanuco, Peru": se queda con lo anterior a
        la coma y compara sin tildes. Primero exacto, luego por prefijo, para
        que "Ambo" no gane sobre "Ambo" exacto si ambos existen.
        """
        if not localidad:
            return None
        objetivo = _sin_tildes(localidad.split(",")[0])
        if not objetivo:
            return None
        celdas = list(self._celdas.values())
        for celda in celdas:
            if _sin_tildes(celda["localidad"]) == objetivo:
                return celda
        for celda in celdas:
            nombre = _sin_tildes(celda["localidad"])
            if nombre.startswith(objetivo) or objetivo.startswith(nombre):
                return celda
        return None

    def _chirps_mensual(self) -> dict[tuple[str, str], float]:
        """(ubigeo, 'AAAA-MM') -> lluvia mensual de CHIRPS en mm. Se lee una vez."""
        if self._chirps is None:
            self._chirps = {}
            ruta = self.directorio / "lluvia_chirps_mensual.csv"
            if ruta.exists():
                with ruta.open(encoding="utf-8-sig") as fh:
                    for f in csv.DictReader(fh):
                        self._chirps[(f["ubigeo"], f["fecha"][:7])] = float(f["lluvia_chirps_mm"])
        return self._chirps

    @lru_cache(maxsize=16)
    def clima(self, celda_id: str) -> list[dict[str, float]] | None:
        """Serie diaria del distrito, con la lluvia ajustada a CHIRPS.

        El parquet trae lluvia diaria de NASA POWER, pero esa serie tiene un
        quiebre: desde 2019 cae a la mitad en todos los distritos, y ademas es
        identica entre distritos vecinos porque viene de una malla gruesa. El
        paquete de datos recomienda CHIRPS, que es mensual.

        Se combinan: POWER dice QUE DIAS llueve y CHIRPS dice CUANTO llovio en
        el mes. Cada dia se multiplica por (CHIRPS del mes / POWER del mes). Si
        POWER no registra lluvia en un mes en que CHIRPS si, se reparte parejo.
        """
        parquet = self.directorio / "clima_diario.parquet"
        if not parquet.exists():
            return None
        import pandas as pd

        datos = pd.read_parquet(parquet, filters=[("ubigeo", "==", str(celda_id))])
        if datos.empty:
            return None
        datos = datos.sort_values("fecha")

        fechas = [f.strftime("%Y-%m-%d") for f in datos["fecha"]]
        power = [float(x or 0.0) for x in datos["lluvia_power_mm"]]
        et0 = [float(x or 0.0) for x in datos["et0_mm"]]

        chirps = self._chirps_mensual()
        total_power: dict[str, float] = {}
        dias_mes: dict[str, int] = {}
        for f, ll in zip(fechas, power):
            total_power[f[:7]] = total_power.get(f[:7], 0.0) + ll
            dias_mes[f[:7]] = dias_mes.get(f[:7], 0) + 1

        serie = []
        for f, ll, e in zip(fechas, power, et0):
            mes = f[:7]
            objetivo = chirps.get((str(celda_id), mes))
            if objetivo is None:
                lluvia = ll  # sin CHIRPS para ese mes: queda el dato diario
            elif total_power[mes] >= 0.5:
                lluvia = ll * objetivo / total_power[mes]
            else:
                lluvia = objetivo / dias_mes[mes]
            serie.append({"fecha": f, "lluvia_mm": round(lluvia, 3), "et0_mm": e})
        return serie

    def lluvia_media_campania_mm(self, celda_id: str) -> float:
        """Lluvia media de una campania de 180 dias, de la serie del distrito."""
        serie = self.clima(celda_id)
        if not serie:
            return 0.0
        anios = len({r["fecha"][:4] for r in serie}) or 1
        return round(sum(r["lluvia_mm"] for r in serie) / anios / 2, 1)
