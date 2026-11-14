"""Orquestador del calculo: la unica puerta entre api/ y engine/.

Los cinco pasos, en orden:
  1. rotations.generar_rotaciones   -> rotaciones validas + motivos
  2. scenarios.generar_escenarios   -> 100 escenarios con semilla
  3. simulacion por tramos          -> 6 cultivos x 3 posiciones x 100 escenarios
                                       = 1800 simulaciones, no 4700
  4. agregacion por rotacion        -> mediana, p10, p90, deficit, cvar_10
  5. selector.seleccionar           -> las tres alternativas

El tramo es la unidad reutilizable: lo que le pasa a la papa en la campania 2
del escenario 37 no depende de que haya antes o despues. Se simula una vez y se
reutiliza en todas las rotaciones que la incluyan en esa posicion.
"""
from __future__ import annotations

import random
import statistics
from datetime import date, timedelta
from typing import Any

from app.engine import rotations, scenarios, selector
from app.engine.contrato import (
    Condiciones,
    Datasets,
    PlanHabitualEvaluado,
    ResultadoMotor,
    Descartadas,
)
from app.engine.economics import margen_soles_ha
from app.engine.soil import indice_suelo
from app.engine.water import balance_hidrico
from app.engine.yield_ import rendimiento_t_ha
from app.schemas.comparacion import CalidadInformacion, CampaniaSecuencia, MetricasCampania
from app.schemas.comun import Nivel, NivelCalidad

# Deficit, en mm por campania, a partir del cual el riesgo sube de nivel.
UMBRAL_RIESGO_MEDIO_MM = 60.0
UMBRAL_RIESGO_ALTO_MM = 150.0


def _serie_del_anio(clima: Any, anio: int, inicio: date, dias: int, factor_lluvia: float) -> list[dict[str, float]]:
    """Toma el tramo del anio historico `anio` que corresponde a esta campania.

    Se conserva el dia del anio, no la fecha exacta: lo que importa es la
    estacion. Si la campania cruza el fin de anio, sigue en el siguiente.
    """
    serie: list[dict[str, float]] = []
    for i in range(dias):
        dia = inicio + timedelta(days=i)
        clave = (anio + (dia.year - inicio.year), dia.month, dia.day)
        registro = clima.get(clave) or clima.get((clave[0], 2, 28) if clave[1:] == (2, 29) else clave)
        if registro is None:
            return []
        serie.append(
            {"lluvia_mm": registro["lluvia_mm"] * factor_lluvia, "et0_mm": registro["et0_mm"]}
        )
    return serie


def _indexar_clima(clima_diario: Any) -> dict[tuple[int, int, int], dict[str, float]]:
    """(anio, mes, dia) -> {lluvia_mm, et0_mm}. Acepta DataFrame o lista."""
    filas = clima_diario.to_dict("records") if hasattr(clima_diario, "to_dict") else list(clima_diario)
    indice = {}
    for f in filas:
        y, m, d = (int(x) for x in str(f["fecha"])[:10].split("-"))
        indice[(y, m, d)] = {"lluvia_mm": float(f["lluvia_mm"]), "et0_mm": float(f["et0_mm"])}
    return indice


def ejecutar_comparacion(condiciones: Condiciones, datasets: Datasets) -> ResultadoMotor:
    """Presupuesto: menos de 8 segundos."""
    fichas = datasets.fichas

    # --- paso 1: rotaciones
    validas, motivos = rotations.generar_rotaciones(condiciones, datasets)
    if not validas:
        return ResultadoMotor(
            alternativas=[],
            plan_habitual=PlanHabitualEvaluado(evaluado=False),
            descartadas=Descartadas(dominadas=0, inviables=sum(motivos.values()), motivos=motivos),
            rotaciones_evaluadas=0,
            escenarios_evaluados=0,
        )

    if datasets.clima_diario is None:
        raise ValueError(
            "el motor real necesita clima diario; datasets.clima_diario llego en None"
        )
    clima = _indexar_clima(datasets.clima_diario)
    todos = {y for (y, _, _) in clima}
    # Una campania que cruza fin de anio sigue en el anio siguiente del clima
    # historico. Si el anio base es el ultimo disponible, ese tramo no existe y
    # el escenario se perdia (unos 10 de 100). Solo se sortean anios con el
    # siguiente completo; si no hubiera ninguno, se usan todos.
    anios = sorted(y for y in todos if (y + 1) in todos) or sorted(todos)

    # --- paso 2: escenarios
    con_riego = float(condiciones.lamina_mm_campania or 0.0) > 0 and condiciones.modo_agua != "secano"
    escenarios = scenarios.generar_escenarios(
        condiciones.n_escenarios, condiciones.semilla, anios, con_riego=con_riego
    )

    # --- paso 3: simulacion por tramos, cacheada por (cultivo, posicion, escenario)
    horizonte = max(1, int(condiciones.horizonte_campanias))
    riego_por_campania = float(condiciones.lamina_mm_campania or 0.0)
    tramos: dict[tuple[str, int, int], dict[str, float]] = {}

    cultivos = sorted({c for sec in validas for c in sec})
    for cultivo in cultivos:
        ficha = fichas[cultivo]
        for posicion in range(horizonte):
            inicio = rotations.siembra_de_campania(condiciones.fecha_inicio, posicion)
            for j, esc in enumerate(escenarios):
                serie = _serie_del_anio(
                    clima, esc["anio_base"], inicio, ficha.duracion_dias,
                    esc["factor_lluvia"] * condiciones.factor_lluvia,
                )
                if not serie:
                    continue
                balance = balance_hidrico(
                    serie, datasets.suelo, ficha.etapas, riego_por_campania * esc["factor_riego"],
                    a_demanda=condiciones.modo_agua == "riego_disponible",
                )
                rend = rendimiento_t_ha(ficha, balance) * _factor_cosecha(
                    datasets.variabilidad, fichas, cultivo, condiciones.semilla, j, posicion
                )
                mercado = _factor_mercado(ficha, condiciones.semilla, j, posicion)
                tramos[(cultivo, posicion, j)] = {
                    "margen": margen_soles_ha(
                        ficha, rend, mercado * esc["factor_precio"] * condiciones.factor_precio
                    ),
                    "deficit": balance.deficit_mm,
                    "demanda": balance.demanda_mm,
                    "rendimiento": rend,
                }

    # --- paso 4: agregacion por rotacion
    metricas = [
        m
        for m in (_agregar(sec, escenarios, tramos, fichas) for sec in validas)
        if m is not None
    ]
    for m in metricas:
        m["secuencia_fechas"] = _secuencia_schema(
            condiciones, m["secuencia"], fichas, m["metricas_campania"]
        )
        m["secuencia_cultivos"] = m["secuencia"]
        m["secuencia"] = m["secuencia_fechas"]

    # --- paso 5: seleccion
    alternativas, dominadas = selector.seleccionar(metricas, condiciones.prioridad)
    escenarios_expuestos = _futuros_comunes(alternativas, escenarios)

    return ResultadoMotor(
        alternativas=alternativas,
        plan_habitual=_evaluar_plan_habitual(condiciones, escenarios, tramos, fichas),
        descartadas=Descartadas(
            dominadas=dominadas, inviables=sum(motivos.values()), motivos=motivos
        ),
        rotaciones_evaluadas=len(validas),
        escenarios_evaluados=len(escenarios),
        escenarios=escenarios_expuestos,
    )


def _factor_mercado(ficha: Any, semilla: int, escenario: int, posicion: int) -> float:
    """Precio de esa campania en ese futuro, relativo a la mediana.

    El precio en chacra no es siempre la mediana: varia de un ano a otro. Se
    sortea entre el p10 y el p90 mensual de la ficha (SIEA/MIDAGRI), con
    interpolacion lineal por tramos alrededor de la mediana. Solo se usa el
    rango observado, sin inventar colas. La semilla hace que el mismo futuro
    tenga el mismo precio en todas las rotaciones que siembran ese cultivo.
    """
    p = ficha.precio_soles_kg
    med = float(p["mediana"])
    if med <= 0:
        return 1.0
    lo, hi = float(p.get("p10", med)), float(p.get("p90", med))
    u = random.Random(f"{semilla}|{escenario}|{posicion}|{ficha.cultivo}").uniform(0.1, 0.9)
    precio = lo + (med - lo) * (u - 0.1) / 0.4 if u < 0.5 else med + (hi - med) * (u - 0.5) / 0.4
    return precio / med


def _cuantil(cuantiles: list[float], u: float) -> float:
    """Valor en la posicion u (0..1) de una lista de cuantiles 0,05..0,95 equiespaciados."""
    if len(cuantiles) == 1:
        return cuantiles[0]
    pos = min(max((u - 0.05) / 0.9, 0.0), 1.0) * (len(cuantiles) - 1)
    i = min(int(pos), len(cuantiles) - 2)
    return cuantiles[i] + (cuantiles[i + 1] - cuantiles[i]) * (pos - i)


def _brecha(variabilidad: dict[str, Any], fichas: dict, cultivo: str) -> float:
    """Cosecha tipica del distrito / rendimiento de referencia de la ficha.

    La ficha usa el p90 de parcelas (lo que logra el mejor 10 %) como techo sin
    estres hidrico. La estadistica MIDAGRI por distrito dice cuanto se cosecha
    de verdad: papa 12,8 t/ha frente a 18. Sin esta brecha el agricultor
    simulado cosecha como el mejor 10 % todos los anios. Los cultivos sin datos
    (quinua, avena) usan la brecha mediana de los que si tienen: es un supuesto.
    """
    def propia(c: str) -> float | None:
        mediano = (variabilidad.get("cultivos", {}).get(c) or {}).get("rendimiento_mediano_t_ha")
        ref = fichas[c].rendimiento_ref_t_ha if c in fichas else None
        return min(1.0, mediano / ref) if mediano and ref else None

    b = propia(cultivo)
    if b is not None:
        return b
    otras = sorted(x for x in (propia(c) for c in fichas) if x is not None)
    return statistics.median(otras) if otras else 1.0


def _factor_cosecha(
    variabilidad: dict[str, Any] | None, fichas: dict, cultivo: str, semilla: int, escenario: int, posicion: int
) -> float:
    """Cuanto de lo que permite el agua se cosecha de verdad en esa campania.

    El balance hidrico solo baja el rendimiento por falta de agua. En la chacra
    se cosecha menos que el techo de la ficha (ver _brecha), hay anios malos
    (plagas, manejo) y area que se pierde (heladas, granizo). Todo sale de la
    estadistica MIDAGRI por distrito: brecha, variacion entre anios del mismo
    distrito y, donde se registra, area perdida. Sin datos, variacion conjunta.
    """
    if not variabilidad:
        return 1.0
    ficha = variabilidad.get("cultivos", {}).get(cultivo) or {}
    relativo = ficha.get("rendimiento_relativo") or variabilidad.get("conjunto", {}).get("rendimiento_relativo")
    rng = random.Random(f"{semilla}|{escenario}|{posicion}|{cultivo}|cosecha")
    factor = _brecha(variabilidad, fichas, cultivo)
    factor *= _cuantil(relativo, rng.random()) if relativo else 1.0
    perdida = ficha.get("perdida_area")
    if perdida:
        factor *= 1.0 - _cuantil(perdida, rng.random())
    return max(0.0, factor)


def _futuros_comunes(alternativas: list, escenarios: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Deja en cada alternativa solo los escenarios simulados en las tres.

    Un escenario cuyo ano base es el ultimo del clima disponible no alcanza a
    cubrir campanias que terminan al ano siguiente: no se simula. Para que el
    indice j sea el mismo futuro en todas las tarjetas, se quitan los
    escenarios que falten en cualquiera. Devuelve la lista de escenarios que
    quedo, en el mismo orden que los margenes.
    """
    con_futuros = [a for a in alternativas if a.futuros is not None]
    if not con_futuros:
        return []
    comunes = [
        j for j in range(len(escenarios))
        if all(a.futuros.margen_por_escenario[j] is not None for a in con_futuros)
    ]
    for a in con_futuros:
        a.futuros.margen_por_escenario = [a.futuros.margen_por_escenario[j] for j in comunes]
    return [escenarios[j] for j in comunes]


def _agregar(
    secuencia: list[str],
    escenarios: list[dict[str, Any]],
    tramos: dict[tuple[str, int, int], dict[str, float]],
    fichas: dict,
) -> dict[str, Any] | None:
    """Suma los tramos de la rotacion escenario por escenario."""
    margenes, deficits, demandas = [], [], []
    familias: list[str] = []
    margen_de: dict[int, float] = {}
    # Una lista por campania y por metrica: la Vista 03 las muestra al tocar
    # cada nodo del abanico.
    por_campania: list[dict[str, list[float]]] = [
        {"margen": [], "deficit": [], "demanda": [], "rendimiento": []} for _ in secuencia
    ]

    for j in range(len(escenarios)):
        claves = [(c, i, j) for i, c in enumerate(secuencia)]
        if any(k not in tramos for k in claves):
            continue
        margenes.append(sum(tramos[k]["margen"] for k in claves))
        familias.append(escenarios[j]["familia"])
        margen_de[j] = margenes[-1]
        deficits.append(sum(tramos[k]["deficit"] for k in claves))
        demandas.append(sum(tramos[k]["demanda"] for k in claves))
        for i, k in enumerate(claves):
            for metrica, serie in por_campania[i].items():
                serie.append(tramos[k][metrica])

    if not margenes:
        return None

    # Antes de ordenar: el margen de cada escenario en el orden de `escenarios`,
    # con None donde el escenario no se pudo simular (ver _futuros_comunes).
    en_orden = [round(margen_de[j], 2) if j in margen_de else None for j in range(len(escenarios))]
    por_familia: dict[str, list[float]] = {}
    for f, x in zip(familias, margenes):
        por_familia.setdefault(f, []).append(x)
    medio_por_familia = {f: round(statistics.fmean(v), 2) for f, v in por_familia.items()}

    margenes.sort()
    n_cola = max(1, len(margenes) // 10)
    costos_horizonte = sum(fichas[c].costo_total_soles_ha for c in secuencia)
    indice, razon = indice_suelo(secuencia, fichas)

    metricas_campania = [
        {m: round(statistics.median(v), 2) if v else 0.0 for m, v in campania.items()}
        for campania in por_campania
    ]
    deficit_mediana_campania = [c["deficit"] for c in metricas_campania]
    riesgos = [_nivel_riesgo(d) for d in deficit_mediana_campania]
    peor = max(riesgos, key=lambda r: ("bajo", "medio", "alto").index(r[0].value))

    return {
        "secuencia": secuencia,
        "metricas_campania": metricas_campania,
        "margen_mediana": round(statistics.median(margenes), 2),
        "margen_promedio": round(statistics.fmean(margenes), 2),
        "margen_p10": round(_percentil(margenes, 10), 2),
        "margen_p90": round(_percentil(margenes, 90), 2),
        "cvar_10": round(sum(margenes[:n_cola]) / n_cola, 2),
        "demanda_mm": round(statistics.median(demandas), 1),
        "deficit_mediana": round(statistics.median(deficits), 1),
        "deficit_p90": round(_percentil(deficits, 90), 1),
        "campanias_con_deficit": sum(1 for d in deficit_mediana_campania if d > 1.0),
        "indice_suelo": indice,
        "razon_suelo": razon,
        "margen_parcial": True,
        "costos_incluidos": sorted(next(iter(fichas.values())).costos_soles_ha),
        # Los costos no varian entre escenarios: son el mismo numero siempre. Por
        # eso su incertidumbre NO entra en el rango p10-p90, y hay que exponerla
        # aparte o el margen aparenta mas precision de la que tiene.
        "costos_soles_ha": round(costos_horizonte, 2),
        # Provisional es la FICHA, no necesariamente sus costos: kc/ky y costos
        # se validan por separado. Si la ficha no detalla que le falta, se
        # asume lo prudente.
        "costos_provisionales": any(
            "costos_soles_ha" in fichas[c].provisional_campos
            if fichas[c].provisional_campos
            else fichas[c].provisional
            for c in secuencia
        ),
        "margen_sensibilidad_costos": {
            "supuesto": "los costos podrian estar mal por +-25 %",
            "si_costaran_25_menos": round(statistics.median(margenes) + costos_horizonte * 0.25, 2),
            "si_costaran_25_mas": round(statistics.median(margenes) - costos_horizonte * 0.25, 2),
        },
        "riesgo_nivel": peor[0],
        "riesgo_principal": peor[1],
        "riesgo_por_campania": riesgos,
        "calidad": _calidad(secuencia, fichas),
        "margenes_por_escenario": en_orden,
        "margen_medio_por_familia": medio_por_familia,
    }


def _percentil(ordenados: list[float], p: float) -> float:
    if not ordenados:
        return 0.0
    k = (len(ordenados) - 1) * p / 100
    bajo, alto = int(k), min(int(k) + 1, len(ordenados) - 1)
    return ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * (k - bajo)


def _nivel_riesgo(deficit_mm: float) -> tuple[Nivel, str | None]:
    if deficit_mm >= UMBRAL_RIESGO_ALTO_MM:
        return Nivel.alto, f"deficit de {deficit_mm:.0f} mm en la mediana de escenarios"
    if deficit_mm >= UMBRAL_RIESGO_MEDIO_MM:
        return Nivel.medio, f"deficit de {deficit_mm:.0f} mm en la mediana de escenarios"
    return Nivel.bajo, None


def _calidad(secuencia: list[str], fichas: dict) -> CalidadInformacion:
    provisionales = sorted({c for c in secuencia if fichas[c].provisional})
    if not provisionales:
        return CalidadInformacion(nivel=NivelCalidad.completa)
    return CalidadInformacion(
        nivel=NivelCalidad.limitada,
        dato_critico="fichas de cultivo provisionales",
        faltantes=provisionales,
        accion_sugerida="confirmar rendimiento de referencia y precios locales",
    )


def _secuencia_schema(
    condiciones: Condiciones,
    secuencia: list[str],
    fichas: dict,
    metricas: list[dict[str, float]] | None = None,
) -> list[CampaniaSecuencia]:
    fechas = rotations.fechas_de_campanias(condiciones, secuencia, fichas)
    metricas = metricas or [{} for _ in secuencia]
    return [
        CampaniaSecuencia(
            campania=i + 1,
            cultivo=c,
            siembra=siembra.isoformat(),
            ventana_dias=fichas[c].duracion_dias,
            cosecha=cosecha.isoformat(),
            metricas=MetricasCampania(
                rendimiento_t_ha=m.get("rendimiento", 0.0),
                deficit_mm=m.get("deficit", 0.0),
                demanda_mm=m.get("demanda", 0.0),
                margen_soles_ha=m.get("margen", 0.0),
            )
            if m
            else None,
        )
        for i, (c, (siembra, cosecha), m) in enumerate(zip(secuencia, fechas, metricas))
    ]


def _evaluar_plan_habitual(
    condiciones: Condiciones,
    escenarios: list[dict[str, Any]],
    tramos: dict,
    fichas: dict,
) -> PlanHabitualEvaluado:
    plan = condiciones.plan_habitual
    if not plan or any(c not in fichas for c in plan):
        return PlanHabitualEvaluado(evaluado=False)
    m = _agregar(list(plan), escenarios, tramos, fichas)
    if m is None:
        return PlanHabitualEvaluado(evaluado=False)
    return PlanHabitualEvaluado(
        evaluado=True,
        margen_soles_ha_mediana=m["margen_mediana"],
        deficit_mm_mediana=m["deficit_mediana"],
        indice_suelo=m["indice_suelo"],
    )
