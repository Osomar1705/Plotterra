"""De textura a laminas de agua aprovechable. Responsable: Breyner.

El motor necesita capacidad de campo y punto de marchitez en mm. SoilGrids no
los publica: entrega textura, carbono organico y densidad aparente. Convertir
unos en otros necesita una funcion de pedotransferencia, y esa eleccion es
agronomica, no de programacion.

Mientras esta funcion devuelva None, el motor usa los valores declarados en
datasets/suelo.json y todo sigue corriendo. No bloquea las pruebas con datos
reales: solo decide si esas pruebas usan una textura medida o una estimacion
puesta a mano.

Lo que hay que implementar, acordado en la ficha del issue:

  Saxton & Rawls (2006), ecuaciones 1 a 5, con arcilla, arena, carbono
  organico y densidad aparente:

    theta_1500 = -0.024 S + 0.487 C + 0.006 MO
                 + 0.005 (S x MO) - 0.013 (C x MO) + 0.068 (S x C) + 0.031
    PM = theta_1500 + (0.14 theta_1500 - 0.02)

    theta_33   = -0.251 S + 0.195 C + 0.011 MO
                 + 0.006 (S x MO) - 0.027 (C x MO) + 0.452 (S x C) + 0.299
    CC = theta_33 + (1.283 theta_33^2 - 0.374 theta_33 - 0.015)

  S y C son fracciones 0-1 de arena y arcilla; MO es materia organica en
  fraccion. El resultado es contenido volumetrico: se pasa a mm multiplicando
  por la profundidad en mm.

Criterios de aceptacion, en tests/test_suelo_hidrico.py:
  - 0 < PM < CC < porosidad total implicada por la densidad aparente
  - Para la textura franca de Ambo (25 % arcilla, 39 % arena, 36 g/kg de
    carbono, 1.19 kg/dm3) el agua aprovechable a 60 cm debe caer entre 60 y
    120 mm. Los valores provisionales de hoy dan 84 mm: si el resultado se
    aleja mucho de esa banda, revisar la conversion de unidades antes que la
    formula.
  - Comparar contra los valores declarados y dejar escrito el porque de la
    diferencia. No se trata de que coincidan, sino de saber cual es mejor.
"""
from __future__ import annotations

# Carbono organico -> materia organica. Factor de Van Bemmelen.
FACTOR_MO = 1.724


def laminas_mm(propiedades: dict, profundidad_cm: float) -> tuple[float, float] | None:
    """(capacidad_campo_mm, punto_marchitez_mm) o None si no se puede derivar.

    None significa "usa lo declarado en suelo.json", que es lo que ocurre hoy.
    """
    return None


def agua_aprovechable_mm(capacidad_campo_mm: float, punto_marchitez_mm: float) -> float:
    """Lo que la planta puede extraer. Es la cifra que gobierna el deficit."""
    return max(0.0, float(capacidad_campo_mm) - float(punto_marchitez_mm))
