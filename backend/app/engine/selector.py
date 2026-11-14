"""Agregacion y seleccion de las tres alternativas."""
from __future__ import annotations

from typing import Any

from app.schemas.comparacion import Alternativa

# Para cada criterio: la metrica y si se busca el maximo o el minimo.
CRITERIOS = {
    "economia": ("margen_mediana", True),
    "agua": ("deficit_mediana", False),
    "suelo": ("indice_suelo", True),
}


def _domina(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """a domina a b si no es peor en nada y es mejor en algo."""
    no_peor = (
        a["margen_mediana"] >= b["margen_mediana"]
        and a["deficit_mediana"] <= b["deficit_mediana"]
        and a["indice_suelo"] >= b["indice_suelo"]
    )
    mejor_en_algo = (
        a["margen_mediana"] > b["margen_mediana"]
        or a["deficit_mediana"] < b["deficit_mediana"]
        or a["indice_suelo"] > b["indice_suelo"]
    )
    return no_peor and mejor_en_algo


def frente_de_pareto(metricas: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    frente = [m for m in metricas if not any(_domina(o, m) for o in metricas if o is not m)]
    return frente, len(metricas) - len(frente)


def seleccionar(
    metricas_por_rotacion: list[dict[str, Any]], prioridad: str
) -> tuple[list[Alternativa], int]:
    """Las tres alternativas, una por criterio, sin repetir plan.

    Descarta las dominadas. Del frente restante toma el mejor margen para
    Economia, el menor deficit para Agua y el mayor indice para Suelo. Si un
    mismo plan gana dos criterios, se cede al segundo mejor del otro para no
    mostrar dos tarjetas iguales.
    """
    if not metricas_por_rotacion:
        return [], 0

    frente, dominadas = frente_de_pareto(metricas_por_rotacion)

    # El criterio de la prioridad elige primero: es el que el agricultor pidio.
    orden = [prioridad] + [c for c in CRITERIOS if c != prioridad]

    elegidas: dict[str, dict[str, Any]] = {}
    usados: set[int] = set()
    for criterio in orden:
        campo, mayor_es_mejor = CRITERIOS[criterio]
        libres = [m for m in frente if id(m) not in usados]
        if not libres:
            break
        mejor = (max if mayor_es_mejor else min)(libres, key=lambda m: m[campo])
        elegidas[criterio] = mejor
        usados.add(id(mejor))

    # Orden fijo economia, agua, suelo: el mismo que devuelve el motor de
    # ejemplo, para que el frontend no tenga que distinguirlos. Cual es la
    # elegida lo dice `destacada`, no la posicion.
    alternativas = [
        _a_alternativa(elegidas[c], c, destacada=(c == prioridad))
        for c in CRITERIOS
        if c in elegidas
    ]
    return alternativas, dominadas


def _a_alternativa(m: dict[str, Any], criterio: str, destacada: bool) -> Alternativa:
    """Arma la tarjeta. Las cifras ya vienen calculadas: aqui no se recalcula nada."""
    from app.schemas.comparacion import Agua, Economia, Futuros, Riesgo, RiesgoCampania, Suelo
    from app.schemas.comun import Nivel, NivelSuelo

    indice = m["indice_suelo"]
    nivel_suelo = NivelSuelo.bueno if indice >= 0.66 else NivelSuelo.regular if indice >= 0.4 else NivelSuelo.pobre

    return Alternativa(
        alternativa_id=f"alt_{criterio}",
        criterio=criterio,
        destacada=destacada,
        secuencia=m["secuencia"],
        economia=Economia(
            margen_soles_ha_mediana=m["margen_mediana"],
            margen_soles_ha_promedio=m["margen_promedio"],
            margen_soles_ha_p10=m["margen_p10"],
            margen_soles_ha_p90=m["margen_p90"],
            cvar_10_soles_ha=m["cvar_10"],
            horizonte_campanias=len(m["secuencia"]),
            margen_parcial=m["margen_parcial"],
            costos_incluidos=m["costos_incluidos"],
            costos_soles_ha=m["costos_soles_ha"],
            costos_provisionales=m["costos_provisionales"],
            margen_sensibilidad_costos=m["margen_sensibilidad_costos"],
        ),
        agua=Agua(
            demanda_mm=m["demanda_mm"],
            deficit_mm_mediana=m["deficit_mediana"],
            deficit_mm_p90=m["deficit_p90"],
            campanias_con_deficit=m["campanias_con_deficit"],
        ),
        suelo=Suelo(indice=indice, nivel=nivel_suelo, razon=m["razon_suelo"]),
        riesgo=Riesgo(
            nivel=m["riesgo_nivel"],
            principal=m["riesgo_principal"],
            detalle_por_campania=[
                RiesgoCampania(campania=i + 1, nivel=n, motivo=mo)
                for i, (n, mo) in enumerate(m["riesgo_por_campania"])
            ],
        ),
        calidad_informacion=m["calidad"],
        futuros=None
        if m.get("margenes_por_escenario") is None
        else Futuros(
            margen_por_escenario=m["margenes_por_escenario"],
            margen_medio_por_familia=m.get("margen_medio_por_familia") or {},
        ),
    )
