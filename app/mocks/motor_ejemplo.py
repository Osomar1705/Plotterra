"""Motor de ejemplo. Responsable: Osmar. No es el motor real.

Existe para una sola cosa: que el servicio responda el contrato completo con
cifras coherentes desde el dia 1, para que frontend no espere a nadie. Es
determinista -- misma entrada y misma semilla, mismo resultado -- pero sus
numeros salen de aritmetica gruesa sobre las fichas de cultivo, no de un
balance hidrico diario.

Toda respuesta que salga de aqui lleva motor.fuente_resultado = "mock". Cuando
Ronald implemente engine/runner.py se pone FIELDSHIFT_MOTOR=real y este archivo
deja de ejecutarse sin que cambie una linea de api/ ni de schemas/.
"""
from __future__ import annotations

import random
from datetime import date, timedelta
from itertools import permutations

from app.engine.contrato import Condiciones, Datasets, FichaCultivo, ResultadoMotor
from app.schemas.comparacion import (
    Agua,
    Alternativa,
    CalidadInformacion,
    CampaniaSecuencia,
    Descartadas,
    Economia,
    PlanHabitualEvaluado,
    Riesgo,
    RiesgoCampania,
    Suelo,
)
from app.schemas.comun import Nivel, NivelCalidad, NivelSuelo, Prioridad

VERSION_MOCK = "0.1.0-mock"
ET0_REFERENCIA_MM_DIA = 4.0
FRACCION_LLUVIA_APROVECHABLE = 0.72
CRITERIOS: tuple[Prioridad, ...] = (Prioridad.economia, Prioridad.agua, Prioridad.suelo)


# ------------------------------------------------------------------ rotaciones
def _ventana_abierta(ficha: FichaCultivo, dia: date) -> bool:
    md = (dia.month, dia.day)
    for desde, hasta in ficha.ventana_siembra:
        d = tuple(int(x) for x in desde.split("-"))
        h = tuple(int(x) for x in hasta.split("-"))
        if (d <= h and d <= md <= h) or (d > h and (md >= d or md <= h)):
            return True
    return False


def _rotaciones(cond: Condiciones, ds: Datasets) -> tuple[list[tuple[str, ...]], dict[str, int], int]:
    motivos: dict[str, int] = {}
    validas: list[tuple[str, ...]] = []
    total = 0
    familia_anterior = ds.fichas[cond.cultivo_anterior].familia if cond.cultivo_anterior in ds.fichas else None

    for secuencia in permutations(cond.cultivos_permitidos, cond.horizonte_campanias):
        total += 1
        familias = [ds.fichas[c].familia for c in secuencia]
        if any(a == b for a, b in zip(familias, familias[1:])):
            motivos["familia_repetida"] = motivos.get("familia_repetida", 0) + 1
            continue
        if familia_anterior is not None and familias[0] == familia_anterior:
            motivos["choca_con_cultivo_anterior"] = motivos.get("choca_con_cultivo_anterior", 0) + 1
            continue
        fijado_roto = next(
            (c for campania, c in cond.cultivos_fijados.items() if secuencia[campania - 1] != c),
            None,
        )
        if fijado_roto is not None:
            motivos["no_respeta_cultivo_fijado"] = motivos.get("no_respeta_cultivo_fijado", 0) + 1
            continue
        if not _ventana_abierta(ds.fichas[secuencia[0]], cond.fecha_inicio):
            motivos["fuera_de_ventana_de_siembra"] = motivos.get("fuera_de_ventana_de_siembra", 0) + 1
            continue
        validas.append(secuencia)
    return validas, motivos, total


# ------------------------------------------------------------------- metricas
def _campania(ficha: FichaCultivo, cond: Condiciones, ds: Datasets) -> dict[str, float]:
    dias = sum(e.dias for e in ficha.etapas)
    demanda = sum(e.kc * e.dias for e in ficha.etapas) * ET0_REFERENCIA_MM_DIA
    lluvia_util = ds.lluvia_media_campania_mm * FRACCION_LLUVIA_APROVECHABLE * (dias / 165)
    aporte = lluvia_util + cond.lamina_mm_campania
    deficit = max(0.0, demanda - aporte)
    ky_medio = sum(e.ky * e.dias for e in ficha.etapas) / dias
    merma = min(0.85, ky_medio * (deficit / demanda)) if demanda else 0.0
    rend_t_ha = ficha.rendimiento_ref_t_ha * (1 - merma)
    precio = ficha.precio_soles_kg["mediana"]
    margen = precio * rend_t_ha * 1000 - ficha.costo_total_soles_ha
    return {"dias": dias, "demanda_mm": demanda, "deficit_mm": deficit, "rend_t_ha": rend_t_ha, "margen": margen}


def _indice_suelo(secuencia: tuple[str, ...], ds: Datasets) -> tuple[float, str]:
    familias = [ds.fichas[c].familia for c in secuencia]
    diversidad = len(set(familias)) / len(familias)
    leguminosa = any(ds.fichas[c].fija_nitrogeno for c in secuencia)
    cobertura = sum(ds.fichas[c].duracion_dias for c in secuencia) / (len(secuencia) * 200)
    indice = 0.40 * diversidad + 0.30 * (1.0 if leguminosa else 0.0) + 0.20 * min(1.0, cobertura) + 0.10
    if leguminosa and diversidad == 1.0:
        razon = f"{len(set(familias))} familias distintas y una leguminosa en la secuencia"
    elif diversidad == 1.0:
        razon = f"{len(set(familias))} familias distintas, sin leguminosa que aporte nitrogeno"
    else:
        razon = "familias repetidas en la secuencia"
    return round(min(1.0, indice), 2), razon


def _nivel_suelo(indice: float) -> NivelSuelo:
    if indice >= 0.70:
        return NivelSuelo.bueno
    return NivelSuelo.regular if indice >= 0.45 else NivelSuelo.pobre


def _evaluar(secuencia: tuple[str, ...], cond: Condiciones, ds: Datasets, rng: random.Random) -> dict:
    campanias = [_campania(ds.fichas[c], cond, ds) for c in secuencia]
    margen = sum(c["margen"] for c in campanias)
    demanda = sum(c["demanda_mm"] for c in campanias)
    deficits = [c["deficit_mm"] for c in campanias]

    # Dispersion entre escenarios: deterministica por semilla y por secuencia.
    semilla_local = random.Random(f"{cond.semilla}:{'-'.join(secuencia)}")
    ancho = 0.28 + 0.12 * semilla_local.random()
    p10 = margen * (1 - ancho)
    p90 = margen * (1 + ancho * 0.9)
    cvar = margen * (1 - ancho * 1.35)
    indice, razon = _indice_suelo(secuencia, ds)

    riesgo_campanias = []
    for i, c in enumerate(secuencia, start=1):
        ficha = ds.fichas[c]
        rango = (ficha.precio_soles_kg["p90"] - ficha.precio_soles_kg["p10"]) / ficha.precio_soles_kg["mediana"]
        if rango > 0.75:
            riesgo_campanias.append(RiesgoCampania(campania=i, nivel=Nivel.medio, motivo=f"precio_{c}"))
        else:
            riesgo_campanias.append(RiesgoCampania(campania=i, nivel=Nivel.bajo, motivo=None))

    peor = max(riesgo_campanias, key=lambda r: (r.nivel == Nivel.medio, r.campania))
    return {
        "secuencia": secuencia,
        "margen": margen,
        "p10": p10,
        "p90": p90,
        "cvar": cvar,
        "demanda_mm": demanda,
        "deficit_mediana": sum(deficits),
        "deficit_p90": sum(deficits) * 1.9 if any(deficits) else 0.0,
        "campanias_con_deficit": sum(1 for d in deficits if d > 1),
        "indice_suelo": indice,
        "razon_suelo": razon,
        "riesgo_campanias": riesgo_campanias,
        "riesgo_nivel": Nivel.medio if peor.motivo else Nivel.bajo,
        "riesgo_principal": peor.motivo,
        "dias": [c["dias"] for c in campanias],
    }


def _secuencia_fechas(ev: dict, cond: Condiciones, ds: Datasets) -> list[CampaniaSecuencia]:
    salida = []
    siembra = cond.fecha_inicio
    for i, (cultivo, dias) in enumerate(zip(ev["secuencia"], ev["dias"]), start=1):
        cosecha = siembra + timedelta(days=dias)
        salida.append(
            CampaniaSecuencia(
                campania=i,
                cultivo=cultivo,
                siembra=siembra.isoformat(),
                ventana_dias=15 if i % 2 else 20,
                cosecha=cosecha.isoformat(),
            )
        )
        siembra = date(cosecha.year + (1 if cosecha.month > 6 else 0), cond.fecha_inicio.month, cond.fecha_inicio.day)
    return salida


def _calidad(ds: Datasets) -> CalidadInformacion:
    faltantes: list[str] = []
    if ds.suelo.provisional:
        faltantes.append("analisis_suelo_local")
    if ds.clima_diario is None:
        faltantes.append("serie_climatica_diaria")
    if any(f.provisional for f in ds.fichas.values()):
        faltantes.append("fichas_de_cultivo_validadas")
    nivel = NivelCalidad.completa if not faltantes else (NivelCalidad.limitada if len(faltantes) < 3 else NivelCalidad.pobre)
    return CalidadInformacion(
        nivel=nivel,
        dato_critico=faltantes[0] if faltantes else None,
        faltantes=faltantes,
        accion_sugerida="editar_suelo" if "analisis_suelo_local" in faltantes else None,
    )


def _dominada(a: dict, b: dict) -> bool:
    """a esta dominada por b: b es mejor o igual en margen, deficit y suelo."""
    return (
        b["margen"] >= a["margen"]
        and b["deficit_mediana"] <= a["deficit_mediana"]
        and b["indice_suelo"] >= a["indice_suelo"]
        and (b["margen"] > a["margen"] or b["deficit_mediana"] < a["deficit_mediana"] or b["indice_suelo"] > a["indice_suelo"])
    )


def ejecutar_comparacion(condiciones: Condiciones, datasets: Datasets) -> ResultadoMotor:
    rng = random.Random(condiciones.semilla)
    validas, motivos, _total = _rotaciones(condiciones, datasets)
    calidad = _calidad(datasets)

    if not validas:
        return ResultadoMotor(
            alternativas=[],
            plan_habitual=PlanHabitualEvaluado(evaluado=False),
            descartadas=Descartadas(dominadas=0, inviables=sum(motivos.values()), motivos=motivos),
            rotaciones_evaluadas=0,
            escenarios_evaluados=condiciones.n_escenarios,
        )

    evaluadas = [_evaluar(s, condiciones, datasets, rng) for s in validas]
    frente = [a for a in evaluadas if not any(_dominada(a, b) for b in evaluadas)]
    dominadas = len(evaluadas) - len(frente)

    # Mejor por criterio, sin repetir tarjetas: si un plan gana dos criterios se
    # toma el segundo mejor del otro.
    orden = {
        Prioridad.economia: sorted(frente, key=lambda e: -e["margen"]),
        Prioridad.agua: sorted(frente, key=lambda e: e["deficit_mediana"]),
        Prioridad.suelo: sorted(frente, key=lambda e: -e["indice_suelo"]),
    }
    elegidas: dict[Prioridad, dict] = {}
    usadas: set[tuple[str, ...]] = set()
    for criterio in sorted(CRITERIOS, key=lambda c: 0 if c.value == condiciones.prioridad else 1):
        for candidata in orden[criterio]:
            if candidata["secuencia"] not in usadas:
                elegidas[criterio] = candidata
                usadas.add(candidata["secuencia"])
                break

    alternativas: list[Alternativa] = []
    for criterio in CRITERIOS:
        ev = elegidas.get(criterio)
        if ev is None:
            continue
        alternativas.append(
            Alternativa(
                alternativa_id=f"alt_{criterio.value}",
                criterio=criterio,
                destacada=criterio.value == condiciones.prioridad,
                secuencia=_secuencia_fechas(ev, condiciones, datasets),
                economia=Economia(
                    margen_soles_ha_mediana=round(ev["margen"], 0),
                    margen_soles_ha_p10=round(ev["p10"], 0),
                    margen_soles_ha_p90=round(ev["p90"], 0),
                    cvar_10_soles_ha=round(ev["cvar"], 0),
                    horizonte_campanias=condiciones.horizonte_campanias,
                    margen_parcial=True,
                    costos_incluidos=["semilla", "fertilizante", "jornales", "cosecha"],
                ),
                agua=Agua(
                    demanda_mm=round(ev["demanda_mm"], 0),
                    deficit_mm_mediana=round(ev["deficit_mediana"], 0),
                    deficit_mm_p90=round(ev["deficit_p90"], 0),
                    campanias_con_deficit=ev["campanias_con_deficit"],
                ),
                suelo=Suelo(
                    indice=ev["indice_suelo"],
                    nivel=_nivel_suelo(ev["indice_suelo"]),
                    razon=ev["razon_suelo"],
                ),
                riesgo=Riesgo(
                    nivel=ev["riesgo_nivel"],
                    principal=ev["riesgo_principal"],
                    detalle_por_campania=ev["riesgo_campanias"],
                ),
                calidad_informacion=calidad,
            )
        )

    plan = PlanHabitualEvaluado(evaluado=False)
    if condiciones.plan_habitual and all(c in datasets.fichas for c in condiciones.plan_habitual):
        ev = _evaluar(tuple(condiciones.plan_habitual), condiciones, datasets, rng)
        plan = PlanHabitualEvaluado(
            evaluado=True,
            margen_soles_ha_mediana=round(ev["margen"], 0),
            deficit_mm_mediana=round(ev["deficit_mediana"], 0),
            indice_suelo=ev["indice_suelo"],
        )

    return ResultadoMotor(
        alternativas=alternativas,
        plan_habitual=plan,
        descartadas=Descartadas(dominadas=dominadas, inviables=sum(motivos.values()), motivos=motivos),
        rotaciones_evaluadas=len(evaluadas),
        escenarios_evaluados=condiciones.n_escenarios,
        version_motor=VERSION_MOCK,
    )
