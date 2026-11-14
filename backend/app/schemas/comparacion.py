"""Salida del stress test: las tres alternativas y su procedencia."""
from __future__ import annotations

from datetime import datetime

from pydantic import Field, computed_field

from app.schemas.comun import (
    BaseSalida as Base,
    EstadoComparacion,
    Etapa,
    Nivel,
    NivelCalidad,
    NivelSuelo,
    OrigenCambio,
    Prioridad,
)

# Niveles canonicos -> claves que usa el frontend para rotular la tarjeta.
NIVEL_RIESGO_EN = {"bajo": "low", "medio": "medium", "alto": "high"}
NIVEL_CALIDAD_EN = {"completa": "sufficient", "limitada": "limited", "pobre": "insufficient"}

# Familias de escenarios del motor -> nombre corto y rotulo que usa el frontend.
FAMILIA_EN = {
    "condiciones_tipicas": "tipica",
    "menor_lluvia": "menos_lluvia",
    "menos_riego": "menos_riego",
    "caida_de_precio": "caida_precio",
    "combinado_adverso": "combinado",
}
FAMILIA_ROTULO = {
    "condiciones_tipicas": "Campaña típica (clima histórico)",
    "menor_lluvia": "Menos lluvia",
    "menos_riego": "Menos riego",
    "caida_de_precio": "Caída de precio",
    "combinado_adverso": "Combinado adverso",
}


class Futuros(Base):
    """La alternativa en cada uno de los escenarios simulados.

    margen_por_escenario[j] es el margen del horizonte (S/ por ha) en el
    escenario j de RespuestaComparacion.simulacion.escenarios: el mismo j es el
    mismo futuro en las tres alternativas, y asi se pueden comparar uno a uno.
    """

    # None solo dentro del motor, antes de _futuros_comunes; la respuesta nunca lo trae.
    margen_por_escenario: list[float | None]
    margen_medio_por_familia: dict[str, float] = Field(default_factory=dict)


class EscenarioResumen(Base):
    id: str
    familia: str
    anio_clima: int
    # Lista para el frontend ("clima 2008"): hoy cada futuro usa un solo ano historico.
    anios_clima: list[str] = Field(default_factory=list)
    factor_lluvia: float
    factor_riego: float
    factor_precio: float


class Simulacion(Base):
    escenarios: list[EscenarioResumen]


class Motor(Base):
    version: str = Field(examples=["0.4.1"])
    semilla: int
    escenarios_evaluados: int
    rotaciones_evaluadas: int
    duracion_ms: int
    version_datasets: str
    fuente_resultado: str = Field(description="calculado, cache o mock.")


class MetricasCampania(Base):
    """Lo que rinde, gasta y deja ESA campania, no la rotacion entera.

    La Vista 03 las necesita para que al tocar un nodo del abanico cambien sus
    cifras. Son medianas sobre los escenarios, igual que las de la tarjeta.

    Ojo al mostrarlas: la suma de los margenes por campania NO da el margen de
    la rotacion. La mediana de las sumas no es la suma de las medianas, y la
    diferencia puede ser grande. Cada cifra es correcta en su nivel; no hay que
    presentarlas como si cuadraran.
    """

    rendimiento_t_ha: float
    deficit_mm: float
    demanda_mm: float
    margen_soles_ha: float


class CampaniaSecuencia(Base):
    campania: int = Field(ge=1, le=3)
    cultivo: str
    siembra: str = Field(description="Fecha ISO de siembra sugerida.")
    ventana_dias: int
    cosecha: str
    metricas: MetricasCampania | None = None


class Economia(Base):
    margen_soles_ha_mediana: float
    margen_soles_ha_p10: float
    margen_soles_ha_p90: float
    margen_soles_ha_promedio: float = Field(
        default=0.0, description="Promedio de los escenarios. La mediana sigue siendo la cifra principal."
    )
    cvar_10_soles_ha: float = Field(
        description="Promedio del margen en el 10 % de escenarios con peor resultado."
    )
    moneda: str = "PEN"
    horizonte_campanias: int
    margen_parcial: bool = Field(
        description="True cuando el margen no incluye todos los costos; la tarjeta debe rotularlo."
    )
    costos_soles_ha: float = Field(
        default=0.0, description="Costos de campania usados en el calculo, sumados en el horizonte."
    )
    costos_provisionales: bool = Field(
        default=True,
        description=(
            "True cuando los costos no tienen fuente local validada. Importa: el rango "
            "p10-p90 recoge la variacion de clima y precio, NO la de costos."
        ),
    )
    margen_sensibilidad_costos: dict = Field(
        default_factory=dict,
        description=(
            "Que le pasa al margen si los costos estuvieran mal por +-25 %. Mientras "
            "los costos sean provisionales, esta banda suele ser mas ancha que p10-p90."
        ),
    )
    costos_incluidos: list[str]


class Agua(Base):
    demanda_mm: float
    deficit_mm_mediana: float
    deficit_mm_p90: float
    campanias_con_deficit: int

    # El contrato con frontend pide que el TIPO de indicador hidrico viaje desde
    # aqui, para que la etiqueta no lo adivine. Demanda, deficit y riego
    # aportado no son sinonimos: esta tarjeta muestra deficit.
    @computed_field
    @property
    def metrica(self) -> str:
        return "deficit"

    @computed_field
    @property
    def valor(self) -> float:
        return self.deficit_mm_mediana

    @computed_field
    @property
    def unidad(self) -> str:
        return "mm"


class Suelo(Base):
    indice: float = Field(ge=0, le=1)
    nivel: NivelSuelo
    razon: str

    @computed_field
    @property
    def compatibilidad(self) -> str:
        """Alias legible del nivel. El indice NO es fertilidad medida."""
        return self.nivel.value


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
    futuros: Futuros | None = None

    @computed_field
    @property
    def outcomes(self) -> dict | None:
        """Los 100 futuros en el formato de la cuadricula del frontend."""
        if self.futuros is None or not self.futuros.margen_por_escenario:
            return None
        v = [x for x in self.futuros.margen_por_escenario if x is not None]
        if not v:
            return None
        peores = sorted(v)[: max(1, len(v) // 10)]
        return {
            "margin_by_scenario": v,
            "wins": sum(1 for x in v if x > 0),
            "losses": sum(1 for x in v if x < 0),
            "mean": round(sum(v) / len(v), 2),
            "adverse": round(sum(peores) / len(peores), 2),
        }

    @computed_field
    @property
    def stress_test(self) -> list[dict] | None:
        """Margen medio por tipo de futuro y su diferencia con el ano tipico."""
        if self.futuros is None or not self.futuros.margen_medio_por_familia:
            return None
        medios = self.futuros.margen_medio_por_familia
        tipica = medios.get("condiciones_tipicas")
        return [
            {
                "familia": FAMILIA_EN.get(f, f),
                "nombre": FAMILIA_ROTULO.get(f, f),
                "margen_medio_S_ha_horizonte": m,
                "cambio_vs_tipica_S_ha": round(m - tipica, 2) if tipica is not None else 0.0,
            }
            for f, m in medios.items()
        ]

    # --- Alias para el frontend. Son vistas de los campos de arriba, no datos
    # nuevos: el contrato canonico no cambia, solo se le agregan campos.
    @computed_field
    @property
    def tipo(self) -> str:
        """Alias de `criterio`. El frontend decide con el la tarjeta que pinta."""
        return self.criterio.value

    @computed_field
    @property
    def campanas(self) -> list[dict]:
        return [
            {
                "orden": c.campania,
                "cultivo": c.cultivo,
                "ventana": f"{c.siembra} a {c.cosecha}",
                "siembra": c.siembra,
                "cosecha": c.cosecha,
                "metrics": None
                if c.metricas is None
                else {
                    "yield": {"value": c.metricas.rendimiento_t_ha, "unit": "t/ha"},
                    "water": {"value": c.metricas.deficit_mm, "unit": "mm"},
                    "economy": {"value": c.metricas.margen_soles_ha, "unit": "S/ha"},
                },
            }
            for c in self.secuencia
        ]

    @computed_field
    @property
    def margen(self) -> dict:
        return {
            "mediana": self.economia.margen_soles_ha_mediana,
            "promedio": self.economia.margen_soles_ha_promedio,
            "adverso": self.economia.cvar_10_soles_ha,
            "minimo": self.economia.margen_soles_ha_p10,
            "maximo": self.economia.margen_soles_ha_p90,
            "moneda": self.economia.moneda,
            "base": "ha",
        }

    @computed_field
    @property
    def calidad_datos(self) -> dict:
        return {
            "nivel": self.calidad_informacion.nivel.value,
            "brecha_principal": self.calidad_informacion.dato_critico,
        }

    # La tarjeta del frontend rotula riesgo y calidad con claves en ingles
    # (low/medium/high, sufficient/limited/insufficient). Con los niveles en
    # espanol no encuentra la etiqueta y la fila sale en blanco. Su normalizador
    # lee primero `risk` y `data_quality`, asi que estos alias ganan.
    @computed_field
    @property
    def risk(self) -> dict:
        return {
            "level": NIVEL_RIESGO_EN[self.riesgo.nivel.value],
            "main_cause": self.riesgo.principal,
        }

    @computed_field
    @property
    def data_quality(self) -> dict:
        return {
            "level": NIVEL_CALIDAD_EN[self.calidad_informacion.nivel.value],
            "main_gap": self.calidad_informacion.dato_critico,
        }


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
    area_ha: float | None = Field(default=None, description="Area de la parcela, para la cabecera.")
    generado_en: datetime
    motor: Motor
    derivada_de: str | None = None
    escenarios_aplicados: list[CambioAplicado] = Field(default_factory=list)
    alternativas: list[Alternativa]
    plan_habitual: PlanHabitualEvaluado
    simulacion: Simulacion | None = None

    @computed_field
    @property
    def status(self) -> str:
        """Alias en ingles de `estado`. La Vista 03 lo compara con "ready"."""
        return {"listo": "ready", "calculando": "processing", "error": "failed"}.get(
            self.estado.value, "ready"
        )

    @computed_field
    @property
    def prioridad(self) -> str | None:
        """La prioridad elegida, tomada de la alternativa destacada."""
        destacada = next((a for a in self.alternativas if a.destacada), None)
        return destacada.criterio.value if destacada else None
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
