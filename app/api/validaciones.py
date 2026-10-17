"""Las siete reglas de entrada, cada una con su codigo de error.

api/ nunca pasa al motor una entrada sin validar: el motor supone que las
condiciones que recibe ya son coherentes.
"""
from __future__ import annotations

import math
from datetime import date
from typing import Any

from app.api.errors import ErrorFieldShift
from app.engine.contrato import FichaCultivo
from app.schemas.comun import ModoAgua
from app.schemas.entrada import CondicionesComparacion, ParcelaCrear
from app.schemas.errores import CodigoError

AREA_MIN_HA = 0.05
AREA_MAX_HA = 50.0
LAMINA_MAX_MM = 1200.0
VERTICES_MINIMOS = 3
CULTIVOS_MINIMOS = 2
PLAN_HABITUAL_CULTIVOS = 3
RADIO_TIERRA_M = 6_378_137.0


# ---------------------------------------------------------------- geometria
def _anillo(poligono: dict[str, Any] | Any) -> list[tuple[float, float]]:
    coords = poligono.coordinates if hasattr(poligono, "coordinates") else poligono["coordinates"]
    if not coords or not coords[0]:
        raise ErrorFieldShift(
            CodigoError.POLIGONO_INVALIDO, "el poligono no trae ningun anillo", campo="geometria"
        )
    return [(float(x), float(y)) for x, y in coords[0]]


def _se_cruzan(p1, p2, p3, p4) -> bool:
    def orient(a, b, c) -> float:
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    d1, d2 = orient(p3, p4, p1), orient(p3, p4, p2)
    d3, d4 = orient(p1, p2, p3), orient(p1, p2, p4)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))


def area_hectareas(poligono: Any) -> float:
    """Area del anillo por la formula del zapatero, con correccion por latitud.

    Suficiente para parcelas de pocas hectareas: el error de proyectar grados a
    metros con el coseno de la latitud media es muy inferior a la incertidumbre
    del trazo a dedo en un celular.
    """
    anillo = _anillo(poligono)
    if anillo[0] != anillo[-1]:
        anillo = anillo + [anillo[0]]
    lat_media = sum(p[1] for p in anillo) / len(anillo)
    k_lon = math.cos(math.radians(lat_media)) * math.pi * RADIO_TIERRA_M / 180.0
    k_lat = math.pi * RADIO_TIERRA_M / 180.0
    doble = 0.0
    for (x1, y1), (x2, y2) in zip(anillo, anillo[1:]):
        doble += (x1 * k_lon) * (y2 * k_lat) - (x2 * k_lon) * (y1 * k_lat)
    return abs(doble) / 2.0 / 10_000.0


def validar_poligono(poligono: Any) -> list[tuple[float, float]]:
    anillo = _anillo(poligono)
    cerrado = anillo[0] == anillo[-1]
    unicos = anillo[:-1] if cerrado else anillo

    if len(unicos) < VERTICES_MINIMOS:
        raise ErrorFieldShift(
            CodigoError.POLIGONO_INVALIDO,
            f"{len(unicos)} vertices; se requieren al menos {VERTICES_MINIMOS}",
            campo="geometria",
        )
    if not cerrado:
        raise ErrorFieldShift(
            CodigoError.POLIGONO_INVALIDO,
            "el anillo no esta cerrado: el ultimo vertice debe repetir el primero",
            campo="geometria",
        )

    lados = list(zip(unicos, unicos[1:] + [unicos[0]]))
    for i, (a, b) in enumerate(lados):
        for j, (c, d) in enumerate(lados):
            if abs(i - j) <= 1 or (i == 0 and j == len(lados) - 1):
                continue
            if _se_cruzan(a, b, c, d):
                raise ErrorFieldShift(
                    CodigoError.POLIGONO_INVALIDO,
                    f"los lados {i} y {j} se cruzan",
                    campo="geometria",
                )
    return unicos


def validar_area(area_ha: float, campo: str = "area_ha") -> float:
    if not (AREA_MIN_HA <= area_ha <= AREA_MAX_HA):
        raise ErrorFieldShift(
            CodigoError.AREA_FUERA_DE_RANGO,
            f"{area_ha:.3f} ha fuera del rango {AREA_MIN_HA}-{AREA_MAX_HA} ha",
            campo=campo,
        )
    return area_ha


def validar_entrada_parcela(entrada: ParcelaCrear) -> None:
    if entrada.geometria is None and entrada.area_declarada_ha is None:
        raise ErrorFieldShift(
            CodigoError.ENTRADA_INVALIDA,
            "hace falta la geometria o el area declarada",
            campo="geometria",
            mensaje_agricultor=(
                "Dibuja la parcela en el mapa, o escribe cuantas hectareas tiene si no logras dibujarla."
            ),
        )
    if entrada.geometria is None and not entrada.localidad:
        raise ErrorFieldShift(
            CodigoError.ENTRADA_INVALIDA,
            "sin geometria hace falta la localidad para resolver la celda climatica",
            campo="localidad",
            mensaje_agricultor="Dinos en que localidad esta la parcela para buscar su clima.",
        )


# ---------------------------------------------------------------- condiciones
def _dentro_de_ventana(dia: date, desde: str, hasta: str) -> bool:
    md = (dia.month, dia.day)
    d_m, d_d = (int(x) for x in desde.split("-"))
    h_m, h_d = (int(x) for x in hasta.split("-"))
    inicio, fin = (d_m, d_d), (h_m, h_d)
    if inicio <= fin:
        return inicio <= md <= fin
    # Ventana que cruza el ano nuevo, p. ej. 10-01 a 01-15.
    return md >= inicio or md <= fin


def cultivos_con_ventana(dia: date, cultivos: list[str], fichas: dict[str, FichaCultivo]) -> list[str]:
    abiertos = []
    for nombre in cultivos:
        ficha = fichas.get(nombre)
        if ficha is None:
            continue
        if any(_dentro_de_ventana(dia, d, h) for d, h in ficha.ventana_siembra):
            abiertos.append(nombre)
    return abiertos


def validar_condiciones(
    cond: CondicionesComparacion,
    fichas: dict[str, FichaCultivo],
    *,
    hoy: date | None = None,
) -> list[str]:
    """Devuelve los cultivos permitidos ya depurados. Lanza al primer fallo."""
    hoy = hoy or date.today()

    desconocidos = [c for c in cond.cultivos_permitidos if c not in fichas]
    if desconocidos:
        raise ErrorFieldShift(
            CodigoError.CULTIVOS_INSUFICIENTES,
            f"cultivos fuera del catalogo: {', '.join(desconocidos)}",
            campo="cultivos_permitidos",
        )

    excluidos = {e.cultivo for e in cond.cultivos_excluidos}
    permitidos = [c for c in cond.cultivos_permitidos if c not in excluidos]
    if len(permitidos) < CULTIVOS_MINIMOS:
        raise ErrorFieldShift(
            CodigoError.CULTIVOS_INSUFICIENTES,
            f"{CULTIVOS_MINIMOS} cultivos requeridos, {len(permitidos)} disponible(s) tras exclusiones",
            campo="cultivos_permitidos",
        )

    if cond.fecha_inicio < hoy:
        raise ErrorFieldShift(
            CodigoError.FECHA_SIN_VENTANA,
            f"fecha_inicio {cond.fecha_inicio.isoformat()} es anterior a hoy {hoy.isoformat()}",
            campo="fecha_inicio",
            mensaje_agricultor="La fecha de inicio ya paso. Elige una fecha de hoy en adelante.",
        )
    if not cultivos_con_ventana(cond.fecha_inicio, permitidos, fichas):
        raise ErrorFieldShift(
            CodigoError.FECHA_SIN_VENTANA,
            f"ningun cultivo habilitado tiene ventana de siembra el {cond.fecha_inicio.isoformat()}",
            campo="fecha_inicio",
        )

    if cond.agua.modo in (ModoAgua.riego_turnos, ModoAgua.riego_disponible):
        lamina = cond.agua.lamina_mm_campania
        if lamina is None or not (0 < lamina < LAMINA_MAX_MM):
            raise ErrorFieldShift(
                CodigoError.AGUA_INVALIDA,
                f"lamina_mm_campania={lamina} debe estar entre 0 y {LAMINA_MAX_MM} con modo {cond.agua.modo.value}",
                campo="agua.lamina_mm_campania",
            )
    elif cond.agua.lamina_mm_campania not in (None, 0):
        raise ErrorFieldShift(
            CodigoError.AGUA_INVALIDA,
            "en secano no corresponde declarar lamina de riego",
            campo="agua.lamina_mm_campania",
        )

    if cond.plan_habitual is not None:
        if len(cond.plan_habitual) != PLAN_HABITUAL_CULTIVOS:
            raise ErrorFieldShift(
                CodigoError.PLAN_HABITUAL_INVALIDO,
                f"plan_habitual con {len(cond.plan_habitual)} cultivos; se esperan {PLAN_HABITUAL_CULTIVOS}",
                campo="plan_habitual",
            )
        fuera = [c for c in cond.plan_habitual if c not in fichas]
        if fuera:
            raise ErrorFieldShift(
                CodigoError.PLAN_HABITUAL_INVALIDO,
                f"plan_habitual con cultivos fuera del catalogo: {', '.join(fuera)}",
                campo="plan_habitual",
            )

    for campania, cultivo in cond.cultivos_fijados.items():
        if campania not in {"1", "2", "3"} or int(campania) > cond.horizonte_campanias:
            raise ErrorFieldShift(
                CodigoError.ENTRADA_INVALIDA,
                f"cultivos_fijados usa la campania {campania}, fuera del horizonte {cond.horizonte_campanias}",
                campo="cultivos_fijados",
                mensaje_agricultor="Esa campania no existe en el plan. Elige la primera, la segunda o la tercera.",
            )
        if cultivo not in permitidos:
            raise ErrorFieldShift(
                CodigoError.CULTIVOS_INSUFICIENTES,
                f"cultivo fijado {cultivo} no esta entre los permitidos",
                campo="cultivos_fijados",
                mensaje_agricultor=f"Pediste {cultivo} en una campania, pero ese cultivo no esta habilitado. Habilitalo para poder fijarlo.",
            )

    if cond.cultivo_anterior is not None and cond.cultivo_anterior not in fichas:
        raise ErrorFieldShift(
            CodigoError.ENTRADA_INVALIDA,
            f"cultivo_anterior {cond.cultivo_anterior} fuera del catalogo",
            campo="cultivo_anterior",
            mensaje_agricultor="Ese cultivo anterior no esta en nuestro catalogo. Elige uno de la lista.",
        )

    return permitidos
