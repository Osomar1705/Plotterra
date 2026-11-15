# FieldShift / Plotterra: chatbot OpenAI en Render

Esta versión utiliza **OpenAI Responses API** en el backend FastAPI, sin Anthropic. Los cambios de cultivo/riego siguen pasando por la validación del motor, y las cifras del simulador no son inventadas por el modelo.

## 1. Actualizar GitHub

Usa el contenido de `Plotterra-main/` para actualizar **la raíz del repositorio conectado a Render**, conservando su estructura (carpetas `backend`, `frontend` y archivo `render.yaml`). No subas claves ni archivos `.env` reales. Si ya trabajas en un repositorio, es preferible copiar los cambios en una rama, revisarlos y hacer commit, no borrar su historial.

## 2. Configurar backend Render > Environment

```
OPENAI_API_KEY=<clave privada OpenAI copiada de la consola>
FIELDSHIFT_MODELO_LLM=gpt-5.4-mini
FIELDSHIFT_PRESUPUESTO_MS=20000
FIELDSHIFT_MOTOR=real
```

`OPENAI_API_KEY` es el **nombre de la variable**. En su campo Value pega únicamente la clave COMPLETA, que no figura en ninguna captura truncada. Nunca la envíes al frontend, GitHub, capturas, ni la escribas en `VITE_*`.

Si en Render existen `ANTHROPIC_API_KEY` o valores de `FIELDSHIFT_MODELO_LLM` con `claude-*`, elimínalos o reemplázalos; no son usados por este código. Comprueba que el proyecto OpenAI tenga facturación/cuota y acceso al modelo indicado. Si `gpt-5.4-mini` no está habilitado, ajusta la variable a un modelo permitido por tu proyecto (por ejemplo `gpt-4.1-mini` si está disponible).

## 3. Configurar frontend Render > Environment

```
VITE_GUIDE_MODE=ai
VITE_USE_LOCAL_MOCKS=false
VITE_API_BASE_URL=https://TU-BACKEND.onrender.com/api/v1
VITE_GUIDE_API_URL=https://TU-BACKEND.onrender.com/api/v1/guide-chat
```

Sustituye `TU-BACKEND` por el subdominio **real** del backend de Render. No copies ciegamente el URL de ejemplo del blueprint. No hay que poner ninguna clave OpenAI en el frontend.

## 4. Desplegar

Render > backend > Manual Deploy > Deploy latest commit. Después Render > frontend > Manual Deploy > Deploy latest commit (las variables `VITE_*` se insertan al compilar). Si utilizas el Blueprint de Render, aplica los cambios y verifica los valores persistidos en ambos servicios.

## 5. Comprobar

1. `https://TU-BACKEND.onrender.com/api/v1/health` debe responder sin error.
2. `https://TU-BACKEND.onrender.com/api/v1/guide-health?probe=true` debe mostrar `"provider":"openai"` y `"probe":{"ok":true,...}`. Esto **hace una llamada real con coste de API**, cacheada durante 60 segundos por proceso.
3. Abre el chatbot, genera una comparación y pregunta `Explain the three options in simple words` y `Which plan is safer?`. Para cambios, `What if I have 30% less irrigation?` debe proponer confirmación, no alterar nada automáticamente.
4. Si `probe.ok=false`, revisa `probe.error.status` y `probe.error.pista`. `401` clave errónea; `403` sin permisos; `404` modelo inexistente; `429` cuota o límite. La clave de la consola puede aparecer como Active y aun así fallar por cuota/facturación.

## Archivos principales modificados

- `backend/app/llm/cliente.py`: cliente HTTP OpenAI Responses con extracción de texto, validación de JSON y pruebas de conexión.
- `backend/app/config.py`: `OPENAI_API_KEY`, modelo y timeout.
- `backend/app/llm/intent.py`: intenciones pasan a OpenAI.
- `backend/app/llm/explain.py`: explicaciones pasan a OpenAI.
- `backend/app/api/routes_guide_chat.py`: chat usa OpenAI; fallback a reglas si falla.
- `backend/app/api/routes_salud.py`: estado/probe OpenAI.
- `backend/requirements.txt`: se retira Anthropic; se usa httpx (ya presente).
- `render.yaml`, `backend/render.yaml`, `frontend/render.yaml`, `backend/.env.example`, `frontend/src/assistant/guideApi.ts`.
- `backend/tests/test_llm.py`: pruebas simuladas OpenAI sin llamadas externas.

## Limitaciones comprobadas

Las pruebas simulan OpenAI, no usan credenciales reales. Los escenarios agrícolas que dependen de archivos parquet requieren `pyarrow` en el entorno de ejecución; se instala desde `backend/requirements.txt` en Render, pero no estaba disponible en el entorno local de revisión. No se modificó el contenido numérico del motor agronómico.
