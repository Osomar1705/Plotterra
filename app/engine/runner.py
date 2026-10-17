"""Orquestador del calculo: la unica puerta entre api/ y engine/.

Responsable: Ronald. Mientras esta funcion no exista, app/engine/puerta.py
despacha al motor de ejemplo y el servicio responde el contrato completo.
Para enchufar el motor real basta implementarla y poner FIELDSHIFT_MOTOR=real:
no se toca api/ ni schemas/.

Los cinco pasos, en orden:
  1. rotations.generar_rotaciones   -> rotaciones validas + motivos
  2. scenarios.generar_escenarios   -> 100 escenarios con semilla
  3. simulacion por tramos          -> 6 cultivos x 3 posiciones x 100 escenarios
                                       = 1800 simulaciones, no 4700
  4. agregacion por rotacion        -> mediana, p10, p90, deficit, cvar_10
  5. selector.seleccionar           -> las tres alternativas
"""
from __future__ import annotations

from app.engine.contrato import Condiciones, Datasets, ResultadoMotor


def ejecutar_comparacion(condiciones: Condiciones, datasets: Datasets) -> ResultadoMotor:
    """Pendiente: bloque de Ronald, dia 5. Presupuesto: menos de 8 segundos."""
    raise NotImplementedError("runner.ejecutar_comparacion: bloque de Ronald")
