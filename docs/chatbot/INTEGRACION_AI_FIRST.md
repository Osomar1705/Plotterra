# Registro de cambios — Guía FieldShift AI-first

Fecha: 2026-11-14.

Base: `FieldShift-NSC-Frontend-INTEGRADO-GUIA-2026-11-14.zip` (derivado de la rama `feat/frontend-video-final`, preservando las tres vistas).

## Cambios

1. `src/assistant/guideApi.ts`: respuesta por IA real como modo por defecto, sin depender de `VITE_USE_LOCAL_MOCKS` ni llamar el asesor determinista salvo `VITE_GUIDE_MODE=demo` explícito. El backend recibe contexto completo de la pantalla.
2. `src/assistant/GuideDrawer.tsx`: el resumen posterior a simulación ahora se solicita a GPT-4o mini, en lugar de mostrar texto predeterminado. Muestra estados de disponibilidad de la IA y distingue las cifras agrícolas de ejemplo.
3. `server/guide-engine.mjs`: instrucciones en español, salida JSON estructurada, controles de evidencia, interpretación de escenarios y validador de cambios.
4. `server/ai-server.mjs`: proxy privado con clave, Responses API, detección de configuración, límites de solicitudes, errores comprensibles y validación de origen.
5. `scripts/dev-with-ai.mjs`: inicia backend IA + frontend desde `npm run dev`.
6. `vite.config.ts`: proxy solo para chat y health sin alterar endpoints agrícolas.
7. `.env.ai.example`, `.env.example`, `.gitignore`: configuración segura separada para backend vs frontend.
8. `tests/guide-engine.test.mjs`: tests de contexto, respuestas, whitelist y llamada Responses simulada.
9. `CHATBOT_INTEGRATION.md`, `README.md`: documentación de instalación, integración FastAPI, límites y criterios de prueba.

## Qué NO cambia

- UI de las tres vistas, comparación, campañas, tarjetas, prioridades, diseño y navegación.
- Motor de cálculo: sigue siendo FastAPI real o mocks existentes.
- Los valores de demostración y las condiciones de NASA/MIDAGRI no se convierten automáticamente en datos reales por usar OpenAI.
- No se hacen simulaciones de cultivos adicionales si no las soporta el motor.

## Estado de validación

- Compilación TypeScript `tsc -b`: correcta con el compilador global del entorno de trabajo.
- Pruebas Node del adaptador a OpenAI y validador: correctas (sin consumir API real).
- Servidor Node: comprobado `GET /api/v1/guide-health` y respuesta segura sin clave.
- Bundle de Vite en este contenedor: no se pudo completar por los binarios nativos de Windows presentes en las dependencias montadas. Ejecutar `npm install && npm run build` en Windows.
- Prueba end-to-end con una clave real de OpenAI: **pendiente de configurar localmente por el equipo**.
