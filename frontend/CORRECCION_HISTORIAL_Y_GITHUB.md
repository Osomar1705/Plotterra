# FieldShift v4 — historial de IA y publicación en GitHub

## Correcciones del chatbot

- En cada consulta se envían los últimos 16 mensajes cronológicos (con roles usuario/asistente) y el contexto actualizado de parcela, alternativas y escenario.
- Las tarjetas de resultados simulados se transforman en contexto textual para la IA. No se confunden con nuevas peticiones de recálculo.
- Inmediatamente después de confirmar un cambio, el resumen recibe tanto el evento de confirmación como los resultados del motor.
- `RESUMEN_POST_SIMULACION` queda forzado a respuesta informativa; no puede volver a proponer el mismo cambio.
- El saludo `hola` no retoma una aclaración de riego que ya terminó.
- En tarjetas de resultados las cifras se muestran como `59/100 casos`, evitando saltos y texto deformado.
- Siguen vigentes los límites de cambios permitidos y no se hacen cálculos ficticios en GPT.

## Ejecutar localmente (Windows PowerShell)

1. Extraer este ZIP en una carpeta, por ejemplo `FieldShift_frontend_v4_CONTEXT_FIX`.
2. Copiar tu `.env.ai` desde la carpeta v4 anterior a la nueva. NO compartir ni subir esa clave.
3. Abrir terminal en la nueva carpeta.
4. `npm install`
5. `npm run test:guide`
6. `npm run dev`
7. Abrir `http://localhost:5173`.

## GitHub — rama nueva y pull request (no modificar main directamente)

Desde PowerShell, situarte en la carpeta donde hayas extraído esta versión. Ejemplo:

```powershell
cd "$env:USERPROFILE\Downloads\FieldShift_frontend_v4_CONTEXT_FIX"
git clone https://github.com/valirus/FieldShift-NSC-Frontend.git "$env:USERPROFILE\Downloads\FieldShift-GitHub"
cd "$env:USERPROFILE\Downloads\FieldShift-GitHub"
git switch -c feat/chatbot-ai-contexto

# Copia los archivos del proyecto actual al clon. Excluye las claves, binarios y los metadatos Git.
robocopy "$env:USERPROFILE\Downloads\FieldShift_frontend_v4_CONTEXT_FIX" "$env:USERPROFILE\Downloads\FieldShift-GitHub" /E /XD .git node_modules dist /XF .env.ai .env .env.local *.log

# Robocopy devuelve códigos 1 a 7 incluso cuando copió bien.
git status
git add .
git status --short
# Verifica que no aparezca .env.ai ni otra clave.
git commit -m "feat: FieldShift v4 chatbot IA con historial de contexto"
git push -u origin feat/chatbot-ai-contexto
```

Luego abrir `https://github.com/valirus/FieldShift-NSC-Frontend` y crear un Pull Request de `feat/chatbot-ai-contexto` hacia `main`. Si ya existe la carpeta `FieldShift-GitHub`, usa otro nombre de destino o actualiza primero ese clon en lugar de clonarlo de nuevo.

**Importante:** antes de `git add .`, asegúrate de que `.env.ai` nunca esté en el clon ni en el staging. El `.gitignore` ya la excluye. Si una clave se filtró, revócala en OpenAI Platform.
