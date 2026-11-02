"""Rotaciones candidatas y sus motivos de descarte.

Cada descarte guarda su motivo: es lo que despues permite explicar al agricultor
por que solo hay dos opciones.
"""
from __future__ import annotations

from datetime import date, timedelta
from itertools import product

from app.engine.contrato import Condiciones, Datasets, FichaCultivo

MOTIVOS = (
    "cultivo_fijado",
    "repite_familia_consecutiva",
    "choca_con_cultivo_anterior",
    "fuera_de_ventana_de_siembra",
)


def _en_ventana(ficha: FichaCultivo, dia: date) -> bool:
    """La ventana se declara como MM-DD y puede cruzar el fin de anio."""
    if not ficha.ventana_siembra:
        return True
    actual = (dia.month, dia.day)
    for desde, hasta in ficha.ventana_siembra:
        d = tuple(int(x) for x in desde.split("-"))
        h = tuple(int(x) for x in hasta.split("-"))
        if d <= h:
            if d <= actual <= h:
                return True
        elif actual >= d or actual <= h:  # cruza diciembre-enero
            return True
    return False


def siembra_de_campania(inicio: date, posicion: int) -> date:
    """Una campania por anio agricola: la siguiente se siembra la proxima temporada.

    En la sierra no caben tres campanias seguidas en el mismo anio. Encadenarlas
    tras la cosecha dejaba la segunda en abril, fuera de toda ventana de siembra.
    """
    try:
        return inicio.replace(year=inicio.year + posicion)
    except ValueError:  # 29 de febrero en un anio no bisiesto
        return inicio.replace(year=inicio.year + posicion, day=28)


def fechas_de_campanias(condiciones: Condiciones, secuencia: list[str], fichas: dict[str, FichaCultivo]) -> list[tuple[date, date]]:
    """Siembra y cosecha de cada campania, una por anio agricola."""
    fechas: list[tuple[date, date]] = []
    for posicion, cultivo in enumerate(secuencia):
        siembra = siembra_de_campania(condiciones.fecha_inicio, posicion)
        fechas.append((siembra, siembra + timedelta(days=fichas[cultivo].duracion_dias)))
    return fechas


def generar_rotaciones(condiciones: Condiciones, datasets: Datasets) -> tuple[list[list[str]], dict[str, int]]:
    """Devuelve (rotaciones_validas, motivos_de_descarte)."""
    fichas = datasets.fichas
    permitidos = [c for c in condiciones.cultivos_permitidos if c in fichas]
    horizonte = max(1, int(condiciones.horizonte_campanias))
    motivos: dict[str, int] = {m: 0 for m in MOTIVOS}

    familia_anterior = (
        fichas[condiciones.cultivo_anterior].familia
        if condiciones.cultivo_anterior and condiciones.cultivo_anterior in fichas
        else None
    )

    validas: list[list[str]] = []
    for combinacion in product(permitidos, repeat=horizonte):
        secuencia = list(combinacion)

        fijado_roto = any(
            secuencia[pos - 1] != cultivo
            for pos, cultivo in condiciones.cultivos_fijados.items()
            if 1 <= pos <= horizonte
        )
        if fijado_roto:
            motivos["cultivo_fijado"] += 1
            continue

        familias = [fichas[c].familia for c in secuencia]

        if any(
            a == b and fichas[secuencia[i]].restricciones.get("no_repetir_familia_consecutiva", True)
            for i, (a, b) in enumerate(zip(familias, familias[1:]))
        ):
            motivos["repite_familia_consecutiva"] += 1
            continue

        if familia_anterior is not None and familias[0] == familia_anterior:
            motivos["choca_con_cultivo_anterior"] += 1
            continue

        fechas = fechas_de_campanias(condiciones, secuencia, fichas)
        if not all(_en_ventana(fichas[c], siembra) for c, (siembra, _) in zip(secuencia, fechas)):
            motivos["fuera_de_ventana_de_siembra"] += 1
            continue

        validas.append(secuencia)

    return validas, {k: v for k, v in motivos.items() if v}
