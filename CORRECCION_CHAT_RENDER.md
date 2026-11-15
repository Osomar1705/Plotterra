# Corrección del chatbot de FieldShift en Render

Se añadió el endpoint POST `/api/v1/guide-chat` en FastAPI, distinto del antiguo `/api/v1/consultas` (que se conserva para compatibilidad). Ahora el frontend puede solicitar explicaciones abiertas o proponer cambios con confirmación antes de recalcular.

## Desplegar

1. Subir los archivos modificados a la **misma rama Git** conectada a Render. Verificar que Render desplegó las nuevas versiones **del backend y del frontend**. Las variables `VITE_*` se incorporan durante el build del frontend: un redeploy de solo backend no basta.
2. En **Render > backend > Environment** configurar `ANTHROPIC_API_KEY` con una clave propia de Anthropic (secreta, nunca en el frontend). El valor de `FIELDSHIFT_MODELO_LLM` puede ser `claude-haiku-5-5` para un modelo más ligero o `claude-opus-5-5` según disponibilidad en la cuenta. El modelo por defecto actual del proyecto sigue siendo `claude-opus-5-5`.
3. En **Render > frontend > Environment** configurar:
   - `VITE_GUIDE_MODE=ai`
   - `VITE_USE_LOCAL_MOCKS=false`
   - `VITE_API_BASE_URL=https://TU-BACKEND.onrender.com/api/v1`
   - `VITE_GUIDE_API_URL=https://TU-BACKEND.onrender.com/api/v1/guide-chat`
   Usar el dominio **exacto** que Render muestra en el servicio backend (las URLs de los archivos YAML son ejemplos y pueden no coincidir con las reales).
4. Guardar las variables y **redeployar frontend y backend** (un frontend estático necesita volver a compilar Vite).
5. Abrir `https://TU-BACKEND.onrender.com/api/v1/health` (debe devolver `estado: ok`) y `https://TU-BACKEND.onrender.com/api/v1/guide-health?probe=true`. Para una conexión LLM real buscar `probe.ok: true`. Si es falso, mirar `probe.error.pista` y los logs del backend.
6. Probar en la app `Explain the three options in simple words` (debería devolver una respuesta de texto) y `What if I have 30% less irrigation?` (debería **proponer** el cambio y pedir confirmación). El motor debe generar una comparación real antes de poder explicar sus resultados concretos.

## Límites de la verificación

- Se verificaron localmente tres tests nuevos del endpoint, sin credenciales externas (3/3 correctos).
- La ejecución del conjunto preexistente de tests no pudo completarse en este entorno por la ausencia de `pyarrow`, que figura en `backend/requirements.txt` para el despliegue Render.
- No se comprobó una llamada a Anthropic con una credencial real ni el dominio de Render en producción. `guide-health?probe=true` es la prueba necesaria tras el despliegue.
- Si falta la clave o Anthropic falla, el chat puede devolver una explicación limitada mediante reglas; esto **no** equivale a disponer de IA generativa y por ello el indicador de conexión lo distingue.
