"""Tipos compartidos por todo el contrato.

Regla del contrato: la unidad viaja en el nombre del campo. Nunca se devuelve
un numero sin unidad.
"""
from __future__ import annotations

from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class Base(BaseModel):
    """Modelo base: prohibe campos desconocidos en las entradas."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Prioridad(str, Enum):
    economia = "economia"
    agua = "agua"
    suelo = "suelo"


class ModoAgua(str, Enum):
    secano = "secano"
    riego_turnos = "riego_turnos"
    riego_disponible = "riego_disponible"


class Confianza(str, Enum):
    medido = "medido"
    estimado = "estimado"
    declarado = "declarado"


class Nivel(str, Enum):
    bajo = "bajo"
    medio = "medio"
    alto = "alto"


class NivelSuelo(str, Enum):
    pobre = "pobre"
    regular = "regular"
    bueno = "bueno"


class NivelCalidad(str, Enum):
    completa = "completa"
    limitada = "limitada"
    pobre = "pobre"


class EstadoComparacion(str, Enum):
    listo = "listo"
    calculando = "calculando"
    error = "error"


class Etapa(str, Enum):
    preparando = "preparando"
    generando_rotaciones = "generando_rotaciones"
    simulando = "simulando"
    seleccionando = "seleccionando"


class OrigenCambio(str, Enum):
    chat = "chat"
    control = "control"


Latitud = Annotated[float, Field(ge=-90, le=90)]
Longitud = Annotated[float, Field(ge=-180, le=180)]


class Poligono(Base):
    """GeoJSON Polygon. Solo el anillo exterior; sin huecos en el MVP."""

    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[tuple[Longitud, Latitud]]] = Field(
        description="Un unico anillo exterior, cerrado: el ultimo vertice repite el primero.",
        examples=[[[[-76.242, -9.931], [-76.239, -9.931], [-76.239, -9.934], [-76.242, -9.934], [-76.242, -9.931]]]],
    )
