"""Indice de compatibilidad agronomica de la secuencia.

El indice expresa compatibilidad de la rotacion, NO un cambio medido de
fertilidad. Devuelve siempre su razon principal para que la interfaz no pueda
presentarlo como una prediccion de fertilidad futura.
"""
from __future__ import annotations

from app.engine.contrato import FichaCultivo

PESOS = {
    "diversidad": 0.40,
    "leguminosa": 0.30,
    "cobertura": 0.20,
    "sanitario": 0.10,
}

# Una campania que cubre el suelo la mayor parte del anio puntua 1.
DIAS_COBERTURA_PLENA = 180.0

RAZONES_BAJAS = {
    "diversidad": "repite familias: la rotacion aporta poca diversidad",
    "leguminosa": "ninguna campania fija nitrogeno",
    "cobertura": "el suelo queda descubierto buena parte del anio",
    "sanitario": "repite familia en campanias seguidas, con riesgo sanitario",
}
RAZONES_ALTAS = {
    "diversidad": "alterna familias distintas en cada campania",
    "leguminosa": "incluye una leguminosa que fija nitrogeno",
    "cobertura": "mantiene el suelo cubierto casi todo el anio",
    "sanitario": "no repite familia en campanias seguidas",
}


def indice_suelo(secuencia: list[str], fichas: dict[str, FichaCultivo]) -> tuple[float, str]:
    """Indice 0-1 y su razon principal.

    Diversidad 0.40, leguminosa 0.30, cobertura 0.20, restricciones 0.10.
    """
    if not secuencia:
        return 0.0, "secuencia vacia"
    presentes = [fichas[c] for c in secuencia if c in fichas]
    if not presentes:
        return 0.0, "ningun cultivo de la secuencia esta en el catalogo"

    familias = [f.familia for f in presentes]
    componentes = {
        "diversidad": len(set(familias)) / len(familias),
        "leguminosa": 1.0 if any(f.fija_nitrogeno for f in presentes) else 0.0,
        "cobertura": min(
            1.0, sum(f.duracion_dias for f in presentes) / (DIAS_COBERTURA_PLENA * len(presentes))
        ),
        "sanitario": 0.0 if any(a == b for a, b in zip(familias, familias[1:])) else 1.0,
    }

    indice = sum(PESOS[k] * v for k, v in componentes.items())

    # La razon es el componente que mas mueve el resultado: el peor si el indice
    # es bajo, el mejor si es alto. Asi la frase nunca contradice al numero.
    if indice < 0.5:
        clave = min(componentes, key=lambda k: componentes[k] * PESOS[k] - PESOS[k])
        razon = RAZONES_BAJAS[clave]
    else:
        clave = max(componentes, key=lambda k: componentes[k] * PESOS[k])
        razon = RAZONES_ALTAS[clave]
    return round(min(1.0, max(0.0, indice)), 3), razon
