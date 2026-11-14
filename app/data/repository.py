"""Lee los datasets preparados, gestiona el estado y registra cada ejecucion.

Es la unica puerta a disco. El motor no abre archivos: recibe un Datasets ya
cargado.
"""
from __future__ import annotations

import csv
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import CONFIG, Config
from app.data.celdas import CatalogoCeldas
from app.data.identificadores import nuevo_id
from app.engine.suelo_hidrico import laminas_mm
from app.engine.contrato import Datasets, EtapaCultivo, FichaCultivo, Suelo


def ahora_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


class DatosNoDisponibles(RuntimeError):
    """La parcela cae fuera de la cobertura preparada."""


class Repositorio:
    def __init__(self, config: Config = CONFIG) -> None:
        self.config = config
        self._fichas: dict[str, FichaCultivo] | None = None
        self._suelos: dict[str, Suelo] | None = None
        self._cobertura: dict[str, Any] | None = None
        self._version_datasets: str = "desconocida"
        self._catalogo = CatalogoCeldas(Path(config.datasets_dir))
        self._conn: sqlite3.Connection | None = None

    # ---------------------------------------------------------------- arranque
    def arrancar(self) -> None:
        """Carga los datasets y crea el esquema. Lo llama main.py al iniciar."""
        self._cargar_datasets()
        self._abrir_db()

    def cerrar(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    @property
    def listo(self) -> bool:
        return self._fichas is not None and self._conn is not None

    # ---------------------------------------------------------------- datasets
    def _leer_json(self, nombre: str) -> dict[str, Any]:
        ruta = Path(self.config.datasets_dir) / nombre
        if not ruta.exists():
            raise DatosNoDisponibles(f"falta el dataset {nombre} en {self.config.datasets_dir}")
        return json.loads(ruta.read_text(encoding="utf-8"))

    def _cargar_datasets(self) -> None:
        cultivos = self._leer_json("cultivos.json")
        suelos = self._leer_json("suelo.json")
        cobertura = self._leer_json("cobertura.json")
        # Opcional: sin este archivo el motor no aplica variacion de rendimiento.
        ruta_var = Path(self.config.datasets_dir) / "variabilidad_rendimiento.json"
        self._variabilidad = json.loads(ruta_var.read_text(encoding="utf-8")) if ruta_var.exists() else None

        meta = cultivos.get("_meta", {})
        self._version_datasets = meta.get("version", "desconocida")

        self._fichas = {}
        for clave, c in cultivos.items():
            if clave.startswith("_"):
                continue
            self._fichas[clave] = FichaCultivo(
                cultivo=clave,
                nombre=c["nombre"],
                familia=c["familia"],
                duracion_dias=c["duracion_dias"],
                ventana_siembra=[(v["desde"], v["hasta"]) for v in c["ventana_siembra"]],
                etapas=[EtapaCultivo(e["nombre"], e["dias"], e["kc"], e["ky"]) for e in c["etapas"]],
                rendimiento_ref_t_ha=c["rendimiento_ref_t_ha"],
                costos_soles_ha=c["costos_soles_ha"],
                precio_soles_kg=c["precio_soles_kg"],
                restricciones=c.get("restricciones", {}),
                provisional=c.get("provisional", True),
                fuente=c.get("fuente", "sin fuente declarada"),
                fija_nitrogeno=c.get("fija_nitrogeno", False),
                provisional_campos=tuple(c.get("provisional_campos", ())),
            )

        self._suelos = {}
        for clave, s in suelos.items():
            if clave.startswith("_"):
                continue
            # Si la pedotransferencia ya existe, manda lo derivado de la textura
            # medida. Mientras devuelva None, valen los valores declarados.
            derivadas = laminas_mm(s.get("textura_medida", {}), s["profundidad_cm"])
            cc, pm = derivadas if derivadas else (s["capacidad_campo_mm"], s["punto_marchitez_mm"])
            self._suelos[clave] = Suelo(
                celda_id=s["celda_id"],
                textura=s["textura"],
                capacidad_campo_mm=cc,
                punto_marchitez_mm=pm,
                profundidad_cm=s["profundidad_cm"],
                materia_organica_pct=s["materia_organica_pct"],
                fuente=s["fuente"],
                incertidumbre=s["incertidumbre"],
                provisional=s.get("provisional", True),
            )

        self._cobertura = cobertura
        self._clima: list[dict] | None = None
        # El paquete distrital, si esta, reemplaza la celda unica.
        if self._catalogo.cargar():
            self._version_datasets = self._catalogo.version

    @property
    def fichas(self) -> dict[str, FichaCultivo]:
        assert self._fichas is not None, "repositorio sin arrancar"
        return self._fichas

    @property
    def version_datasets(self) -> str:
        return self._version_datasets

    @property
    def celdas(self) -> list[dict[str, Any]]:
        assert self._cobertura is not None, "repositorio sin arrancar"
        if self._catalogo.disponible:
            return self._catalogo.celdas()
        return self._cobertura["celdas"]

    @property
    def parcela_demostrativa(self) -> dict[str, Any]:
        assert self._cobertura is not None, "repositorio sin arrancar"
        return self._cobertura["parcela_demostrativa"]

    def celda_por_punto(self, lon: float, lat: float) -> dict[str, Any] | None:
        if self._catalogo.disponible:
            return self._catalogo.por_punto(lon, lat)
        for celda in self.celdas:
            b = celda["bbox"]
            if b["lon_min"] <= lon <= b["lon_max"] and b["lat_min"] <= lat <= b["lat_max"]:
                return celda
        return None

    def celda_por_localidad(self, localidad: str | None) -> dict[str, Any] | None:
        if not localidad:
            return None
        if self._catalogo.disponible:
            return self._catalogo.por_localidad(localidad)
        objetivo = localidad.strip().lower()
        for celda in self.celdas:
            if celda["localidad"].strip().lower() == objetivo:
                return celda
        return None

    def datasets_de(self, celda_id: str) -> Datasets:
        assert self._suelos is not None
        if self._catalogo.disponible:
            celda = self._catalogo.celda(celda_id)
            suelo = self._catalogo.suelo(celda_id)
            if celda is None or suelo is None:
                raise DatosNoDisponibles(f"celda {celda_id} sin datasets preparados")
            return Datasets(
                fichas=self.fichas,
                suelo=suelo,
                celda_id=celda_id,
                localidad=celda["localidad"],
                lluvia_media_campania_mm=self._catalogo.lluvia_media_campania_mm(celda_id),
                version_datasets=self.version_datasets,
                clima_diario=self._catalogo.clima(celda_id),
                variabilidad=self._variabilidad,
            )
        celda = next((c for c in self.celdas if c["celda_id"] == celda_id), None)
        if celda is None or celda_id not in self._suelos:
            raise DatosNoDisponibles(f"celda {celda_id} sin datasets preparados")
        return Datasets(
            fichas=self.fichas,
            suelo=self._suelos[celda_id],
            celda_id=celda_id,
            localidad=celda["localidad"],
            lluvia_media_campania_mm=celda["lluvia_media_campania_mm"],
            version_datasets=self.version_datasets,
            clima_diario=self._clima_diario(),
            variabilidad=self._variabilidad,
        )

    def _clima_diario(self) -> list[dict] | None:
        """Serie diaria real; None si el CSV no esta y el motor de ejemplo basta."""
        if self._clima is not None:
            return self._clima
        ruta = Path(self.config.datasets_dir) / "clima_diario.csv"
        if not ruta.exists():
            return None
        with ruta.open(encoding="utf-8") as fh:
            self._clima = [
                {
                    "fecha": f["fecha"],
                    "lluvia_mm": float(f["lluvia_mm"]),
                    "et0_mm": float(f["et0_mm"]),
                }
                for f in csv.DictReader(fh)
            ]
        return self._clima

    def lluvia_media_campania_mm(self, celda_id: str) -> float:
        """Media de campania del distrito. 0 si la celda no tiene serie."""
        if self._catalogo.disponible:
            return self._catalogo.lluvia_media_campania_mm(celda_id)
        celda = next((c for c in self.celdas if c["celda_id"] == celda_id), None)
        return float(celda["lluvia_media_campania_mm"]) if celda else 0.0

    def fuente_clima(self, celda_id: str) -> str:
        if self._catalogo.disponible:
            c = self._catalogo.celda(celda_id)
            return c["fuente_clima"] if c else "sin fuente declarada"
        celda = next((c for c in self.celdas if c["celda_id"] == celda_id), None)
        return celda["fuente_clima"] if celda else "sin fuente declarada"

    # -------------------------------------------------------------------- sqlite
    def _abrir_db(self) -> None:
        Path(self.config.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.config.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        esquema = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
        self._conn.executescript(esquema)
        self._conn.commit()

    @property
    def conn(self) -> sqlite3.Connection:
        assert self._conn is not None, "repositorio sin arrancar"
        return self._conn

    # ------------------------------------------------------------------ sesiones
    def asegurar_sesion(self, sesion_id: str | None) -> str:
        if not sesion_id:
            sesion_id = nuevo_id("sesion")
        fila = self.conn.execute(
            "SELECT sesion_id FROM sesiones WHERE sesion_id = ?", (sesion_id,)
        ).fetchone()
        if fila is None:
            self.conn.execute(
                "INSERT INTO sesiones (sesion_id, creada_en, ultimo_acceso) VALUES (?, ?, ?)",
                (sesion_id, ahora_iso(), ahora_iso()),
            )
        else:
            self.conn.execute(
                "UPDATE sesiones SET ultimo_acceso = ? WHERE sesion_id = ?", (ahora_iso(), sesion_id)
            )
        self.conn.commit()
        return sesion_id

    # ------------------------------------------------------------------ parcelas
    def guardar_parcela(
        self,
        *,
        sesion_id: str,
        geometria: dict[str, Any] | None,
        area_ha: float,
        celda_id: str,
        localidad: str,
        origen_area: str,
    ) -> str:
        parcela_id = nuevo_id("parcela")
        self.conn.execute(
            """INSERT INTO parcelas
               (parcela_id, sesion_id, geometria_geojson, area_ha, celda_id, localidad, origen_area, creada_en)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                parcela_id,
                sesion_id,
                json.dumps(geometria) if geometria else None,
                area_ha,
                celda_id,
                localidad,
                origen_area,
                ahora_iso(),
            ),
        )
        self.conn.commit()
        return parcela_id

    def parcela(self, parcela_id: str) -> dict[str, Any] | None:
        fila = self.conn.execute(
            "SELECT * FROM parcelas WHERE parcela_id = ?", (parcela_id,)
        ).fetchone()
        if fila is None:
            return None
        datos = dict(fila)
        datos["geometria"] = json.loads(datos["geometria_geojson"]) if datos["geometria_geojson"] else None
        return datos

    # --------------------------------------------------------------- ejecuciones
    def registrar_ejecucion(
        self,
        *,
        comparacion_id: str,
        parcela_id: str,
        condiciones: dict[str, Any],
        cambios: list[dict[str, Any]],
        derivada_de: str | None,
        version_motor: str,
        semilla: int,
        duracion_ms: int,
        estado: str,
        clave_cache: str,
    ) -> None:
        self.conn.execute(
            """INSERT OR REPLACE INTO ejecuciones
               (comparacion_id, parcela_id, condiciones_json, derivada_de, cambios_json,
                version_motor, semilla, version_datasets, duracion_ms, estado, clave_cache, creada_en)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                comparacion_id,
                parcela_id,
                json.dumps(condiciones, default=str),
                derivada_de,
                json.dumps(cambios, default=str),
                version_motor,
                semilla,
                self.version_datasets,
                duracion_ms,
                estado,
                clave_cache,
                ahora_iso(),
            ),
        )
        self.conn.commit()

    def ejecucion(self, comparacion_id: str) -> dict[str, Any] | None:
        fila = self.conn.execute(
            "SELECT * FROM ejecuciones WHERE comparacion_id = ?", (comparacion_id,)
        ).fetchone()
        return dict(fila) if fila else None

    # --------------------------------------------------------------- respuestas
    def guardar_respuesta(self, comparacion_id: str, cuerpo: dict[str, Any]) -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO respuestas (comparacion_id, cuerpo_json, guardada_en) VALUES (?, ?, ?)",
            (comparacion_id, json.dumps(cuerpo, default=str), ahora_iso()),
        )
        for alt in cuerpo.get("alternativas", []):
            metricas = {k: alt[k] for k in ("economia", "agua", "suelo", "riesgo", "calidad_informacion") if k in alt}
            self.conn.execute(
                """INSERT OR REPLACE INTO resultados
                   (comparacion_id, alternativa_id, metricas_json, secuencia_json) VALUES (?, ?, ?, ?)""",
                (
                    comparacion_id,
                    alt["alternativa_id"],
                    json.dumps(metricas, default=str),
                    json.dumps(alt["secuencia"], default=str),
                ),
            )
        self.conn.commit()

    def respuesta(self, comparacion_id: str) -> dict[str, Any] | None:
        fila = self.conn.execute(
            "SELECT cuerpo_json FROM respuestas WHERE comparacion_id = ?", (comparacion_id,)
        ).fetchone()
        return json.loads(fila["cuerpo_json"]) if fila else None

    def respuesta_por_clave(self, clave: str) -> dict[str, Any] | None:
        """El camino de la cache: si la clave existe, la respuesta sale de disco."""
        fila = self.conn.execute(
            """SELECT r.cuerpo_json FROM ejecuciones e
               JOIN respuestas r ON r.comparacion_id = e.comparacion_id
               WHERE e.clave_cache = ? AND e.estado = 'listo'
               ORDER BY e.creada_en DESC LIMIT 1""",
            (clave,),
        ).fetchone()
        return json.loads(fila["cuerpo_json"]) if fila else None


REPO = Repositorio()
