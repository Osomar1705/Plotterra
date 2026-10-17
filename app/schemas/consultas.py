"""Consulta en lenguaje natural y aplicacion del cambio.

La consulta y la aplicacion estan separadas a proposito: el wireframe exige
mostrar la interpretacion antes de ejecutarla, y esa separacion es tambien la
que evita que una interpretacion equivocada del LLM dispare un recalculo.
"""
from __future__ import annotations

from enum import Enum

from pydantic import Field

from app.schemas.comun import Base, OrigenCambio


class Intent(str, Enum):
    ajustar_riego = "ajustar_riego"
    excluir_cultivo = "excluir_cultivo"
    fijar_cultivo_campania = "fijar_cultivo_campania"
    cambiar_prioridad = "cambiar_prioridad"
    explicar = "explicar"


class ConsultaCrear(Base):
    comparacion_id: str
    texto: str = Field(min_length=2, max_length=500)


class Interpretacion(Base):
    intent: Intent
    parametros: dict
    descripcion: str = Field(description="Lo que se le muestra al agricultor antes de confirmar.")
    etiqueta: str = Field(description="Texto corto para la etiqueta eliminable.", examples=["riego -30 %"])
    confianza: float = Field(ge=0, le=1)


class RespuestaConsulta(Base):
    interpretacion: Interpretacion | None = None
    aplicable: bool
    requiere_confirmacion: bool = True
    interpretado_por: str = Field(description="llm o reglas.")
    sugerencias: list[str] = Field(
        default_factory=list,
        description="Tres salidas cuando no se entiende la pregunta; nunca se deja al agricultor sin salida.",
    )


class CambioCrear(Base):
    intent: Intent
    parametros: dict = Field(default_factory=dict)
    origen: OrigenCambio = OrigenCambio.chat


class DatosYSupuestos(Base):
    comparacion_id: str
    fuentes: list[dict]
    versiones: dict
    supuestos: list[str]
    limitaciones: list[str]
    generado_en: str
