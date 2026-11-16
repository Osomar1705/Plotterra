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

## v2
- Simulación: la animación corre en paralelo al cálculo (ya no espera ~10 s); si el motor tarda, queda en la última prueba con aviso.
- Nota al pie sobre El Niño / La Niña en la pantalla de simulación.
- Chat con IA: modelo por defecto gpt-4.1-mini y respaldo automático (gpt-4o-mini) si el configurado falla o no responde texto; FIELDSHIFT_MODELO_LLM puede quedar sin definir.

## v3
- Simulación: los cuadros se llenan desde el primer segundo en azul neutro ("probando") mientras el motor calcula; al llegar los resultados reales cambian a verde/naranja.

## v4
- Chat: responde en inglés si la pregunta está en inglés (español solo si preguntan en español); solo habla de los 3 planes reales; cifras en USD.
- Simulación: en la escena de "Lower prices" los medidores van abajo para no tapar el gráfico de la ilustración.

## v5
- Escena "Lower prices": se eliminó de la ilustración la tarjeta de moneda y gráfico; los medidores vuelven arriba como en las otras escenas.
