# Integración de dos ramas y Guía FieldShift — 14/11/2026

## Fuentes recibidas

- `FieldShift-NSC-Frontend-main (1).zip`
- `FieldShift-NSC-Frontend-feat-frontend-video-final.zip`
- `Pasted text(20261114-160900).txt` (requerimientos conversacionales)

## Decisión de merge

Los archivos de `feat/frontend-video-final` fueron usados como base porque contienen las tres vistas, el plan de una sola alternativa, campañas clickeables, transiciones y simulaciones. `main` aportó la referencia de estructura y contratos preexistentes. No se sustituyó Vista 03 por el placeholder de `main`.

## Cambios implementados

- Guía FieldShift global y persistente en Parcela/Opciones/Plan.
- Identidad profesional con brote, sin mascota caricaturesca.
- Contexto por parcela, tres alternativas, escenario activo, alternativa y campaña seleccionada.
- Intenciones de preguntas sobre sistema, fuentes, comparación, justificación de una alternativa y posición del cultivo.
- Preguntas de seguimiento y aclaración con chips dinámicos.
- Escenarios con confirmación y recálculo separado del chat.
- Drawer se oculta durante el cálculo y reabre al terminar.
- Historial de sesión, voz de lectura opcional, errores comprensibles.
- Preparación de `/api/v1/consultas` en modos legacy y contextual.
- Corrección de los mocks para conservar área/prioridad entre páginas.
- Restricción explícita: no simular otros cambios con cifras de riego si no hay resultados.

## No incluido / limitaciones honestas

- No hay LLM ejecutándose en modo local. `demoAdvisor.ts` contiene respuestas deterministas de demostración.
- No hay memoria permanente entre visitas ni entrada por voz.
- Las explicaciones agronómicas finas por campaña requieren datos específicos del motor y no se inventan.
- Los contadores de escenarios del overlay son texto de demostración hasta su verificación con Backend.

## Validación

- `tsc -b`: comprobación de tipos realizada.
- 14 casos de la lógica local (información, comparación, escenarios, aclaración, cultivo y seguridad) verificados con Node.
- No se garantiza build Vite Linux con los binarios opcionales de Windows incluidos en las fuentes; la entrega excluye `node_modules` y se instala con `npm install` en el equipo de destino.
