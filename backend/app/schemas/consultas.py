"""Consulta en lenguaje natural y aplicacion del cambio.

La consulta y la aplicacion estan separadas a proposito: el wireframe exige
mostrar la interpretacion antes de ejecutarla, y esa separacion es tambien la
que evita que una interpretacion equivocada del LLM dispare un recalculo.
"""
from __future__ import annotations

from enum import Enum

from pydantic import Field, computed_field

from app.schemas.comun import Base, OrigenCambio


class Intent(str, Enum):
    ajustar_riego = "ajustar_riego"
    ajustar_lluvia = "ajustar_lluvia"
    ajustar_precio = "ajustar_precio"
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


# Intent del motor -> el cambio que el frontend sabe reenviar a /cambios.
# La vuelta (type/operation/value/unit -> intent/parametros) la hace compat.py,
# asi que el objeto que se devuelve aqui es el mismo que acepta aplicar_cambio.
_TIPO_FRONTEND = {
    Intent.ajustar_riego: "irrigation",
    Intent.ajustar_lluvia: "rainfall",
    Intent.ajustar_precio: "price",
    Intent.excluir_cultivo: "exclude_crop",
    Intent.fijar_cultivo_campania: "first_crop",
    Intent.cambiar_prioridad: "priority",
}


class RespuestaConsulta(Base):
    interpretacion: Interpretacion | None = None
    aplicable: bool
    requiere_confirmacion: bool = True
    interpretado_por: str = Field(description="llm o reglas.")
    sugerencias: list[str] = Field(
        default_factory=list,
        description="Tres salidas cuando no se entiende la pregunta; nunca se deja al agricultor sin salida.",
    )
    idioma: str = Field(default="es", description="es o en: el de la pregunta, para responder igual.")

    # --- Alias para el asistente del frontend. Lee `status` y `cambio` en la
    # raiz; sin ellos daba "Reformular" aunque el backend hubiera entendido.
    @computed_field
    @property
    def status(self) -> str:
        return "understood" if self.interpretacion else "needs_clarification"

    @computed_field
    @property
    def cambio(self) -> dict | None:
        i = self.interpretacion
        if i is None:
            return None
        tipo = _TIPO_FRONTEND.get(i.intent, i.intent.value)
        base: dict = {"tipo": tipo, "type": tipo, "etiqueta": i.etiqueta, "label": i.etiqueta}

        if "factor" in i.parametros:
            factor = float(i.parametros["factor"])
            base.update(
                operacion="reduce" if factor < 1 else "increase",
                operation="reduce" if factor < 1 else "increase",
                valor=round(abs(1 - factor) * 100),
                value=round(abs(1 - factor) * 100),
                unidad="percent",
                unit="percent",
            )
        else:
            # excluir_cultivo, fijar_cultivo_campania y cambiar_prioridad viajan
            # con su valor tal cual: el cultivo o la prioridad.
            valor = i.parametros.get("cultivo") or i.parametros.get("prioridad")
            base.update(operacion="set", operation="set", valor=valor, value=valor)
            if "campania" in i.parametros:
                base["campania"] = i.parametros["campania"]
        return base

    @computed_field
    @property
    def mensaje(self) -> str | None:
        """Lo que el asistente muestra cuando no entendio."""
        if self.interpretacion:
            return self.interpretacion.descripcion
        if self.idioma == "en":
            return "We did not understand the question. Try one of these:"
        return "No entendimos la pregunta. Prueba con una de estas:"


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
