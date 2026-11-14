# Mejoras del chatbot — 14/11/2026

## Problema corregido
El usuario podía escribir “¿Qué pasa si tengo 30 % menos riego?”, recibir una aclaración innecesaria, contestar “30 %” y perder el contexto. También se detectó un ejemplo donde la IA afirmaba **126 mm** antes de ejecutar el motor, sin respaldo.

## Solución
- El frontend conserva `pendingClarification` durante la conversación y se lo envía al servidor mediante `pending_clarification`.
- `server/guide-engine.mjs` recibe ese estado y detecta porcentajes explícitos en una propuesta de riego. Valida `1–99 %` y, cuando es admisible, genera una propuesta estructurada que el agricultor debe confirmar.
- La confirmación se construye exclusivamente desde el cambio **validado**, sin presentar valores de agua o márgenes no calculados.
- Antes de simular no hay extrapolación numérica; el motor conserva la autoridad sobre las métricas agrícolas.
- Las respuestas de texto pueden contener Markdown ligero generado por IA (**negritas**, párrafos, listas cortas, emoticonos poco frecuentes). `GuideFormattedText` lo renderiza de manera segura como elementos React sin interpretar HTML externo.
- El prompt de GPT-4o mini pide respuestas breves y orientadas a agricultores, incluyendo viñetas solo cuando hagan más legible una comparación.

## Configuración
No cambia: copia `.env.ai.example` a `.env.ai` e introduce `OPENAI_API_KEY` solo en tu equipo. Reinicia `npm run dev` si has cambiado archivos del servidor. No subas `.env.ai` a GitHub.

## Pruebas
`npm run test:guide` valida el contexto conversacional, la propuesta directa de 30 %, el seguimiento “30 %” y la prevención de cifras anticipadas. Para validar con IA real, prueba ambas preguntas con tu propia clave y comprueba que el panel **Sí, recalcular** aparece antes de mostrar números nuevos.
