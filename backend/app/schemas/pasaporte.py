"""Pasaporte de campana de una alternativa."""
from __future__ import annotations

from pydantic import Field

from app.schemas.comun import BaseSalida as Base
from app.schemas.comparacion import (
    Agua,
    CalidadInformacion,
    CampaniaSecuencia,
    Economia,
    Riesgo,
    Suelo,
)


class ParcelaResumen(Base):
    area_ha: float
    localidad: str


class Metricas(Base):
    economia: Economia
    agua: Agua
    suelo: Suelo
    riesgo: Riesgo
    calidad_informacion: CalidadInformacion


class Explicacion(Base):
    """Los tres textos los redacta el LLM a partir de las cifras ya calculadas.

    Si la llamada al LLM falla, se devuelven textos de plantilla construidos con
    esas mismas cifras y el pasaporte sigue siendo utilizable.
    """

    por_que_conviene: str
    que_se_sacrifica: str
    que_dato_cambiaria: str
    redactado_por: str = Field(description="llm o plantilla.")


class ComparacionConPlanHabitual(Base):
    margen_delta_soles_ha: float | None = None
    deficit_delta_mm: float | None = None


class Exportable(Base):
    pdf_url: str


class Pasaporte(Base):
    comparacion_id: str
    alternativa_id: str
    parcela: ParcelaResumen
    secuencia: list[CampaniaSecuencia]
    metricas: Metricas
    explicacion: Explicacion
    comparacion_con_plan_habitual: ComparacionConPlanHabitual
    exportable: Exportable
