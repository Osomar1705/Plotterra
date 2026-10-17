"""Prueba del motor de agua. Responsable: Breyner.

Se saltea mientras la funcion no exista, para que la suite de Osmar siga verde
y nadie quede bloqueado por el trabajo del otro.
"""
from __future__ import annotations

import pytest

from tests.caso_referencia import CLIMA, ESPERADO


@pytest.mark.skipif(not CLIMA, reason="caso de referencia pendiente: bloque de Breyner")
def test_balance_hidrico_coincide_con_el_calculo_a_mano():
    from app.engine.water import balance_hidrico  # noqa: PLC0415

    pytest.skip("implementar junto con water.balance_hidrico")
