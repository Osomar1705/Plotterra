"""Caso de referencia del motor de agua.

Define si el motor miente o no. La condicion para que sirva: los numeros de
ESPERADO NO pueden salir de app.engine.water. Si salieran, la prueba se
validaria a si misma y pasaria con cualquier formula.

Por eso el caso usa un clima sintetico elegido para que la cuenta se pueda
seguir a mano, y la aritmetica completa esta escrita abajo.

  Suelo:   capacidad de campo 100 mm, punto de marchitez 40 mm
           -> agua aprovechable 60 mm, perfil lleno al sembrar
  Cultivo: etapa "inicial" 10 dias Kc 0.5 ; etapa "media" 15 dias Kc 1.0
  Clima:   ET0 constante 4,0 mm/dia durante 25 dias, sin riego

  Etapa inicial, dias 1-10:  ETc = 0,5 x 4,0 = 2,0 mm/dia  -> 20,0 mm
    El almacenamiento baja 100 -> 80. Nunca toca el punto de marchitez,
    asi que ETa = ETc y el deficit de la etapa es 0.

  Etapa media, dias 11-25:   ETc = 1,0 x 4,0 = 4,0 mm/dia  -> 60,0 mm
    CASO A, sin lluvia:
      dias 11-20: el almacenamiento baja 80 -> 40 extrayendo 4,0 mm/dia = 40 mm
      dias 21-25: ya esta en 40, no hay agua aprovechable -> ETa = 0
      ETa de la etapa = 40 mm, deficit = 60 - 40 = 20 mm

    CASO B, 10 mm de lluvia el dia 21:
      dias 11-20: igual que en A, almacenamiento 40, ETa 40 mm
      dia 21: 40 + 10 = 50 ; ETa = min(4, 50-40) = 4  -> 46
      dia 22: ETa = min(4, 46-40) = 4                 -> 42
      dia 23: ETa = min(4, 42-40) = 2                 -> 40
      dias 24-25: ETa = 0
      ETa de la etapa = 40 + 4 + 4 + 2 = 50 mm, deficit = 60 - 50 = 10 mm

  Totales: demanda = 20 + 60 = 80 mm en ambos casos.
           deficit = 20 mm (A) y 10 mm (B). Almacenamiento final 40 mm.
"""
from __future__ import annotations

ET0_DIARIO = 4.0
DIAS_INICIAL = 10
DIAS_MEDIA = 15

SUELO = {
    "capacidad_campo_mm": 100.0,
    "punto_marchitez_mm": 40.0,
    "profundidad_cm": 60,
}

ETAPAS = [
    {"nombre": "inicial", "dias": DIAS_INICIAL, "kc": 0.5, "ky": 0.4},
    {"nombre": "media", "dias": DIAS_MEDIA, "kc": 1.0, "ky": 1.1},
]


def _clima(lluvia_por_dia: dict[int, float]) -> list[dict[str, float]]:
    """25 dias con ET0 constante y lluvia solo en los dias indicados (1-based)."""
    return [
        {"lluvia_mm": lluvia_por_dia.get(i + 1, 0.0), "et0_mm": ET0_DIARIO}
        for i in range(DIAS_INICIAL + DIAS_MEDIA)
    ]


CLIMA = _clima({})                  # caso A: secano puro
CLIMA_CON_LLUVIA = _clima({21: 10.0})  # caso B: 10 mm el dia 21

ESPERADO = {
    "demanda_mm": 80.0,
    "deficit_mm": 20.0,
    "almacenamiento_final_mm": 40.0,
    "deficit_por_etapa": {"inicial": 0.0, "media": 20.0},
    "tolerancia_mm": 0.05,
}

ESPERADO_CON_LLUVIA = {
    "demanda_mm": 80.0,
    "deficit_mm": 10.0,
    "almacenamiento_final_mm": 40.0,
    "deficit_por_etapa": {"inicial": 0.0, "media": 10.0},
    "tolerancia_mm": 0.05,
}
