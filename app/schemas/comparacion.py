"""Salida del stress test: las tres alternativas y su procedencia."""
from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.comun import (
    Base,
    EstadoComparacion,
    Etapa,
    Nivel,
    NivelCalidad,
    NivelSuelo,
    OrigenCambio,
    Prioridad,
)


class Motor(Base):
    version: str = Field(examples=["0.4.1"])
    semilla: int
    escenarios_evaluados: int
    rotaciones_evaluadas: int
    duracion_ms: int
    version_datasets: str
    fuente_resultado: str = Field(description="calculado, cache o mock.")


class CampaniaSecuencia(Base):
    campania: int = Field(ge=1, le=3)
    cultivo: str
    siembra: str = Field(description="Fecha ISO de siembra sugerida.")
    ventana_dias: int
    cosecha: str


class Economia(Base):
    margen_soles_ha_mediana: float
    margen_soles_ha_p10: float
    margen_soles_ha_p90: float
    cvar_10_soles_ha: float = Field(
        description="Promedio del margen en el 10 % de escenarios con peor resultado."
    )
    moneda: str = "PEN"
    horizonte_campanias: int
    margen_parcial: bool = Field(
        description="True cuando el margen no incluye todos los costos; la tarjeta debe rotularlo."
    )
    costos_incluidos: list[str]


class Agua(Base):
    demanda_mm: float
    deficit_mm_mediana: float
    deficit_mm_p90: float
    campanias_con_deficit: int


class Suelo(Base):
    indice: float = Field(ge=0, le=1)
    nivel: NivelSuelo
    razon: str


class RiesgoCampania(Base):
    campania: int
    nivel: Nivel
    motivo: str | None = None


class Riesgo(Base):
    nivel: Nivel
    principal: str | None = None
    detalle_por_campania: list[RiesgoCampania]


class CalidadInformacion(Base):
    nivel: NivelCalidad
    dato_critico: str | None = None
    faltantes: list[str] = Field(default_factory=list)
    accion_sugerida: str | None = None


class Alternativa(Base):
    alternativa_id: str = Field(examples=["alt_agua"])
    criterio: Prioridad
    destacada: bool = Field(
        description="True en la alternativa que coincide con la prioridad elegida."
    )
    secuencia: list[CampaniaSecuencia]
    economia: Economia
    agua: Agua
    suelo: Suelo
    riesgo: Riesgo
    calidad_informacion: CalidadInformacion


class PlanHabitualEvaluado(Base):
    evaluado: bool
    margen_soles_ha_mediana: float | None = None
    deficit_mm_mediana: float | None = None
    indice_suelo: float | None = None


class Descartadas(Base):
    dominadas: int
    inviables: int
    motivos: dict[str, int] = Field(default_factory=dict)


class CambioAplicado(Base):
    cambio_id: str = Field(examples=["chg_01"])
    intent: str
    etiqueta: str = Field(description="Texto de la etiqueta eliminable sobre las tarjetas.")
    origen: OrigenCambio
    parametros: dict = Field(default_factory=dict)


class ResumenDelCambio(Base):
    margen_delta_soles_ha: float
    deficit_delta_mm: float
    cambio_de_orden: bool


class RespuestaComparacion(Base):
    comparacion_id: str = Field(examples=["cmp_3a7d"])
    estado: EstadoComparacion = EstadoComparacion.listo
    parcela_id: str
    generado_en: datetime
    motor: Motor
    derivada_de: str | None = None
    escenarios_aplicados: list[CambioAplicado] = Field(default_factory=list)
    alternativas: list[Alternativa]
    plan_habitual: PlanHabitualEvaluado
    descartadas: Descartadas
    resumen_del_cambio: ResumenDelCambio | None = None


class ComparacionCalculando(Base):
    """202: el calculo no termino dentro del presupuesto.

    No se envia porcentaje de avance: el wireframe pide no simular progreso.
    """

    comparacion_id: str
    estado: EstadoComparacion = EstadoComparacion.calculando
    etapa: Etapa
    reintentar_en_ms: int = 1500
