"""Balance hidrico diario.

Firma congelada en engine/contrato.py (BalanceHidrico). Funcion pura: no importa
FastAPI ni SQLite y se prueba sola con pytest contra tests/caso_referencia.py.

Dos supuestos que no estaban en el acuerdo y hay que poder discutir:
  - El perfil arranca a capacidad de campo. Se siembra tras las primeras
    lluvias, no sobre suelo seco.
  - La lamina de riego de la campania se reparte en partes iguales entre los
    dias. El motor no conoce el calendario de riego real del agricultor.
"""
from __future__ import annotations

from typing import Any

from app.engine.contrato import BalanceResultado, DeficitEtapa, EtapaCultivo, Suelo


def _kc_por_dia(etapas: list[EtapaCultivo]) -> list[tuple[str, float, float]]:
    """Expande las etapas a una lista por dia: (nombre_etapa, kc, ky)."""
    dias: list[tuple[str, float, float]] = []
    for e in etapas:
        dias.extend([(e.nombre, e.kc, e.ky)] * int(e.dias))
    return dias


def balance_hidrico(
    clima: Any,
    suelo: Suelo,
    etapas: list[EtapaCultivo],
    lamina_riego_mm: float,
    a_demanda: bool = False,
) -> BalanceResultado:
    """Balance diario de agua en el perfil, acumulando deficit por etapa.

    `clima` es una secuencia de dias, cada uno con lluvia_mm y et0_mm, al menos
    tan larga como la campania. Acepta dicts o cualquier objeto con esos
    atributos, para no atar el motor a pandas.
    """
    dias_cultivo = _kc_por_dia(etapas)
    if not dias_cultivo:
        raise ValueError("el cultivo no declara etapas")

    serie = list(clima)[: len(dias_cultivo)]
    if len(serie) < len(dias_cultivo):
        raise ValueError(
            f"la serie de clima tiene {len(serie)} dias y la campania necesita {len(dias_cultivo)}"
        )

    cc = float(suelo.capacidad_campo_mm)
    pm = float(suelo.punto_marchitez_mm)
    if cc <= pm:
        raise ValueError("capacidad de campo menor o igual que punto de marchitez")

    riego_diario = max(0.0, float(lamina_riego_mm)) / len(dias_cultivo)
    almacenamiento = cc  # supuesto: se siembra con el perfil lleno

    # Riego disponible (a_demanda): la misma lamina total, pero se aplica cuando
    # hace falta. Se riega antes de que el agua baje de la mitad de la
    # aprovechable (p = 0,5, valor tipico de FAO-56) y se repone hasta capacidad
    # de campo. El agua se va habilitando al ritmo de la campania: lo que no se
    # usa en dias de lluvia queda guardado para despues, pero no se puede gastar
    # por adelantado (si no, toda la lamina se iba en la primera sequia y no
    # quedaba nada para floracion). Riego por turnos: la lamina repartida pareja,
    # llueva o no; lo que cae con el perfil lleno se pierde.
    usado = 0.0
    umbral = pm + 0.5 * (cc - pm)

    acumulado: dict[str, list[float]] = {}
    orden: list[str] = []

    for i, ((nombre, kc, _ky), dia) in enumerate(zip(dias_cultivo, serie)):
        lluvia = float(dia["lluvia_mm"] if isinstance(dia, dict) else dia.lluvia_mm)
        et0 = float(dia["et0_mm"] if isinstance(dia, dict) else dia.et0_mm)

        etc = kc * et0

        # Lluvia efectiva: lo que pasa de capacidad de campo percola y se pierde.
        if a_demanda:
            almacenamiento = min(cc, almacenamiento + lluvia)
            habilitado = riego_diario * (i + 1) - usado
            if habilitado > 0 and almacenamiento - etc < umbral:
                dosis = min(habilitado, cc - almacenamiento)
                almacenamiento += dosis
                usado += dosis
        else:
            almacenamiento = min(cc, almacenamiento + lluvia + riego_diario)

        # La planta no puede extraer por debajo del punto de marchitez.
        eta = min(etc, max(0.0, almacenamiento - pm))
        almacenamiento -= eta

        if nombre not in acumulado:
            acumulado[nombre] = [0.0, 0.0]
            orden.append(nombre)
        acumulado[nombre][0] += etc
        acumulado[nombre][1] += eta

    por_etapa = [
        DeficitEtapa(
            etapa=n,
            etc_mm=round(acumulado[n][0], 2),
            eta_mm=round(acumulado[n][1], 2),
            deficit_mm=round(acumulado[n][0] - acumulado[n][1], 2),
        )
        for n in orden
    ]
    return BalanceResultado(
        demanda_mm=round(sum(e.etc_mm for e in por_etapa), 2),
        deficit_mm=round(sum(e.deficit_mm for e in por_etapa), 2),
        por_etapa=por_etapa,
        almacenamiento_final_mm=round(almacenamiento, 2),
    )
