"""Frontera entre los tres bloques del backend. Co-propiedad de los tres.

Cambiar una firma de este archivo rompe el trabajo de otra persona, asi que se
cambia en conjunto y no a mitad de un dia de trabajo. Todo lo demas de cada
bloque es libre.

    Osmar   -> api/, schemas/, data/   llama ejecutar_comparacion()
    Ronald  -> rotations, scenarios, runner, selector   implementa ejecutar_comparacion()
    Breyner -> water, yield_, economics, soil           implementa las cuatro de abajo
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Protocol

from app.schemas.comparacion import Alternativa, Descartadas, PlanHabitualEvaluado

VERSION_MOTOR = "0.3.0"


# --------------------------------------------------------------------------
# Datos que el motor recibe ya cargados. Los prepara data/repository.py.
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class Suelo:
    celda_id: str
    textura: str
    capacidad_campo_mm: float
    punto_marchitez_mm: float
    profundidad_cm: float
    materia_organica_pct: float
    fuente: str
    incertidumbre: str
    provisional: bool = True


@dataclass(frozen=True)
class EtapaCultivo:
    nombre: str
    dias: int
    kc: float
    ky: float


@dataclass(frozen=True)
class FichaCultivo:
    cultivo: str
    nombre: str
    familia: str
    duracion_dias: int
    ventana_siembra: list[tuple[str, str]]
    etapas: list[EtapaCultivo]
    rendimiento_ref_t_ha: float
    costos_soles_ha: dict[str, float]
    precio_soles_kg: dict[str, float]
    restricciones: dict[str, Any]
    provisional: bool
    fuente: str
    fija_nitrogeno: bool = False
    provisional_campos: tuple[str, ...] = ()
    """Que partes de la ficha no tienen fuente validada.

    `provisional` dice si algo en la ficha lo es; esto dice QUE. Importa
    porque los costos y los kc/ky se validan por separado y pesan distinto.
    """

    @property
    def costo_total_soles_ha(self) -> float:
        return float(sum(self.costos_soles_ha.values()))


@dataclass(frozen=True)
class Datasets:
    """Lo que el motor puede leer. Nada mas: ni HTTP, ni SQLite, ni disco."""

    fichas: dict[str, FichaCultivo]
    suelo: Suelo
    celda_id: str
    localidad: str
    lluvia_media_campania_mm: float
    version_datasets: str
    clima_diario: Any | None = field(
        default=None,
        metadata={"nota": "DataFrame con fecha, lluvia_mm, t_max_c, t_min_c, et0_mm. None mientras no exista el parquet."},
    )
    # datasets/variabilidad_rendimiento.json: cuanto varia la cosecha entre anios
    # y cuanta area se pierde (MIDAGRI). None = el motor no aplica variacion.
    variabilidad: dict[str, Any] | None = None


@dataclass(frozen=True)
class Condiciones:
    """Las condiciones ya validadas. api/ nunca pasa una entrada sin validar."""

    parcela_id: str
    area_ha: float
    fecha_inicio: date
    cultivo_anterior: str | None
    modo_agua: str
    lamina_mm_campania: float
    cultivos_permitidos: list[str]
    prioridad: str
    plan_habitual: list[str] | None
    cultivos_fijados: dict[int, str]
    horizonte_campanias: int
    n_escenarios: int
    semilla: int
    # Factores que pide el agricultor ("y si llueve menos", "y si baja el
    # precio"). Se multiplican SOBRE los del escenario, no lo reemplazan: el
    # stress test sigue siendo stress test.
    factor_lluvia: float = 1.0
    factor_precio: float = 1.0


@dataclass
class ResultadoMotor:
    """Lo que devuelve el motor. api/ solo lo envuelve en la respuesta HTTP."""

    alternativas: list[Alternativa]
    plan_habitual: PlanHabitualEvaluado
    descartadas: Descartadas
    rotaciones_evaluadas: int
    escenarios_evaluados: int
    version_motor: str = VERSION_MOTOR
    # Los escenarios en el orden en que se simularon. futuros.margen_por_escenario
    # de cada alternativa sigue este orden: el indice j es el mismo futuro en todas.
    escenarios: list[dict[str, Any]] = field(default_factory=list)


# --------------------------------------------------------------------------
# Puerta 1: la unica que cruza api/ -> engine/. La implementa Ronald.
# --------------------------------------------------------------------------
class MotorComparacion(Protocol):
    def __call__(self, condiciones: Condiciones, datasets: Datasets) -> ResultadoMotor: ...


# --------------------------------------------------------------------------
# Puerta 2: las cuatro funciones de fisica. Las implementa Breyner.
# Ronald las llama; nadie mas.
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class DeficitEtapa:
    etapa: str
    etc_mm: float
    eta_mm: float
    deficit_mm: float


@dataclass(frozen=True)
class BalanceResultado:
    """Resultado del balance hidrico de UNA campana."""

    demanda_mm: float
    deficit_mm: float
    por_etapa: list[DeficitEtapa]
    almacenamiento_final_mm: float


class BalanceHidrico(Protocol):
    def __call__(
        self,
        clima: Any,
        suelo: Suelo,
        etapas: list[EtapaCultivo],
        lamina_riego_mm: float,
    ) -> BalanceResultado:
        """ETc = Kc(etapa) x ET0; deficit = suma de ETc - ETa acumulada por etapa."""


class RendimientoTHa(Protocol):
    def __call__(self, cultivo: FichaCultivo, balance: BalanceResultado) -> float:
        """(1 - Ya/Ym) = Ky x (1 - ETa/ETc) por etapa. Aqui se enchufa el modelo de ML."""


class MargenSolesHa(Protocol):
    def __call__(self, cultivo: FichaCultivo, rend_t_ha: float, factor_precio: float) -> float:
        """Margen = precio x rendimiento - costos de la campana."""


class IndiceSuelo(Protocol):
    def __call__(self, secuencia: list[str], fichas: dict[str, FichaCultivo]) -> tuple[float, str]:
        """Indice 0 a 1 y su razon principal. Diversidad 0.40, leguminosa 0.30,
        cobertura 0.20, restricciones sanitarias 0.10."""
