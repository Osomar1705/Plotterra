# FieldShift — integración para demo de 2 minutos

Esta versión integra el material disponible de Vista 01, Vista 02 y `feat/pasaporte-v2`.

## Flujo
1. `/` — Parcela y condiciones, optimizado para Ambo.
2. `/opciones` — Economía / Agua / Suelo + escenario de riego y asistente.
3. `/plan` — Explorador de rutas y pasaporte, activado desde el trabajo de `pasaporte-v2`.

## Nota de integración
El material recibido de `pasaporte-v2` referenciaba `FanGraph`, `PeacockMark`, `AlternativePassport` y `getAlternativePassport`, pero esos archivos/contratos no estaban incluidos. Esta versión completa esas interfaces para que la Vista 03 quede conectada sin descartar el trabajo existente. El pasaporte usa mock en modo demo y deja preparado el endpoint real.

## Demo del video
El recorrido prioritario sigue siendo Parcela → Opciones → Asistente → Riego −30% → comparación recalculada. Vista 03 queda disponible para demostración adicional o preguntas del jurado.

## UI polish final
La versión final mantiene el mismo flujo y contratos. Vista 02 usa identidad cromática por criterio (Economía/Agua/Suelo), jerarquía reforzada de KPIs y microinteracciones. Vista 03 hereda ese lenguaje visual sin añadir pasos ni información nueva.
