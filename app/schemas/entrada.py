"""Entradas del agricultor: la parcela y las condiciones de la comparacion."""
from __future__ import annotations

from datetime import date

from pydantic import Field, field_validator

from app.schemas.comun import (
    Base,
    Confianza,
    ModoAgua,
    Poligono,
    Prioridad,
)


class SugerenciaNumerica(Base):
    valor: float
    fuente: str
    editable: bool = True


class SugerenciaSuelo(Base):
    textura: str
    capacidad_campo_mm: float
    punto_marchitez_mm: float
    fuente: str
    incertidumbre: str
    editable: bool = True


class Sugerencias(Base):
    lluvia_media_campania_mm: SugerenciaNumerica
    suelo: SugerenciaSuelo


class ParcelaCrear(Base):
    """Crear la parcela.

    area_declarada_ha cubre el caso del wireframe: el agricultor que no logra
    dibujar el poligono en el celular escribe las hectareas y el backend acepta
    la parcela sin geometria, resolviendo la celda climatica por la localidad.
    """

    sesion_id: str | None = Field(default=None, examples=["ses_7c01"])
    geometria: Poligono | None = None
    area_declarada_ha: float | None = Field(default=None, gt=0)
    localidad: str | None = Field(default=None, examples=["Huanuco"])


class ParcelaCreada(Base):
    parcela_id: str = Field(examples=["prc_8f21"])
    sesion_id: str = Field(examples=["ses_7c01"])
    area_ha: float
    celda_id: str = Field(examples=["hco_0412"])
    localidad: str
    origen_area: str = Field(description="dibujada o declarada.")
    sugerencias: Sugerencias


class AguaEntrada(Base):
    modo: ModoAgua
    lamina_mm_campania: float | None = Field(
        default=None, description="Lamina de riego disponible por campana. Obligatoria si el modo es de riego."
    )
    confianza: Confianza = Confianza.estimado


class CultivoExcluido(Base):
    cultivo: str
    motivo: str = Field(examples=["sin_comprador"])


class EscenariosEntrada(Base):
    n: int = Field(default=100, ge=10, le=500)
    semilla: int = Field(default=20261010)


class CondicionesComparacion(Base):
    parcela_id: str = Field(examples=["prc_8f21"])
    fecha_inicio: date
    cultivo_anterior: str | None = None
    agua: AguaEntrada
    cultivos_permitidos: list[str] = Field(min_length=1)
    cultivos_excluidos: list[CultivoExcluido] = Field(default_factory=list)
    prioridad: Prioridad
    plan_habitual: list[str] | None = Field(default=None)
    cultivos_fijados: dict[str, str] = Field(
        default_factory=dict,
        description="Campania (1, 2 o 3) -> cultivo que el agricultor fija ahi. Lo escribe el intent fijar_cultivo_campania.",
        examples=[{"1": "papa"}],
    )
    horizonte_campanias: int = Field(default=3, ge=1, le=3)
    escenarios: EscenariosEntrada = Field(default_factory=EscenariosEntrada)

    @field_validator("cultivos_permitidos")
    @classmethod
    def _sin_repetidos(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("cultivos_permitidos no admite repetidos")
        return v
