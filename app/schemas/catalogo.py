"""Catalogo: lo que el frontend necesita para armar los campos sin quemar listas."""
from __future__ import annotations

from pydantic import Field

from app.schemas.comun import Base


class VentanaSiembra(Base):
    desde: str = Field(description="MM-DD")
    hasta: str = Field(description="MM-DD")


class CultivoCatalogo(Base):
    cultivo: str
    nombre: str
    variedad: str | None = None
    familia: str
    duracion_dias: int
    ventana_siembra: list[VentanaSiembra]
    rendimiento_ref_t_ha: float
    precio_soles_kg_mediana: float
    provisional: bool = Field(
        description="True mientras el dato sea una semilla del equipo y no la version de tratamiento de data."
    )
    fuente: str


class LimiteNumerico(Base):
    minimo: float
    maximo: float
    unidad: str


class LimitesValidacion(Base):
    area_ha: LimiteNumerico
    lamina_mm_campania: LimiteNumerico
    vertices_minimos: int
    cultivos_permitidos_minimos: int
    plan_habitual_cultivos: int
    horizonte_campanias_maximo: int


class CeldaCobertura(Base):
    celda_id: str
    localidad: str
    lluvia_media_campania_mm: float
    fuente_clima: str


class Catalogo(Base):
    cultivos: list[CultivoCatalogo]
    prioridades: list[str]
    modos_agua: list[str]
    limites: LimitesValidacion
    cobertura: list[CeldaCobertura]
    version_datasets: str
    version_motor: str
