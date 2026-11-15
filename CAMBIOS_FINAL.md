# Versión final (base: Plotterra-main_3)

- Backend: el de Plotterra-main_3 (motor con el arreglo del p90) + chat con OpenAI (/guide-chat, OPENAI_API_KEY). Ver INSTRUCCIONES_OPENAI_RENDER.md.
- Frontend: el del equipo (cámara/onboarding) + cambios de Gerardo:
  - Simulación con 3 imágenes (lluvia fuerte, caída de precio, suelo muerto), más rápida.
  - "What hurts this plan most?" muestra directo cuánto gana o pierde.
  - Cuadrado seleccionado queda marcado hasta elegir otro.
  - Cabecera de Opciones con ambiente según la tarjeta (se mantiene).
  - Opciones: luz que sigue al cursor + borde vivo (opción 10).
  - Plan: tooltip con mini-gráfico al pasar sobre un cuadrado (opción 8).
- La API key va solo en Render (backend) o en frontend/.env.ai local; nunca en VITE_*.
