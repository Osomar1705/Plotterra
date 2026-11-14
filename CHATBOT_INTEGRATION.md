# FieldShift · Integración del asistente real

La UI del asistente ya está preparada para un chatbot real sin cambiar el componente visual.

## Punto de conexión

`src/api/fieldshiftApi.ts` → `interpretAssistant(comparisonId, message)`

Actualmente, con `VITE_USE_LOCAL_MOCKS=false`, se usa:

- `POST /api/v1/consultas`

Payload actual:

```json
{
  "comparison_id": "cmp_123",
  "consulta": "¿Qué pasa si tengo 30% menos riego?"
}
```

Respuesta mínima esperada cuando entiende la consulta:

```json
{
  "status": "understood",
  "intent": "modify_scenario",
  "change": {
    "type": "irrigation",
    "operation": "reduce",
    "value": 30,
    "unit": "percent",
    "label": "Riego −30%"
  },
  "needs_confirmation": true
}
```

También admite:

- `needs_clarification` + `clarification`
- `unsupported`

La UI mantiene historial visual local, muestra estado de interpretación, pide confirmación antes de ejecutar cambios y permite seguir conversando después de cada simulación.

## Regla de producto

El LLM interpreta y explica. Las métricas numéricas deben seguir llegando del motor de comparación mediante los endpoints de cambios/comparaciones; el asistente no debe inventar cifras.

## Para añadir memoria conversacional real

Si Backend necesita historial, la única modificación necesaria es extender `interpretAssistant()` para enviar una lista de mensajes junto a `comparison_id` y `consulta`. La UI ya conserva el historial visual en `AssistantDrawer.tsx`.

### Payload recomendado cuando Backend agregue memoria conversacional

La UI ya conserva `turns` localmente. Cuando el backend acepte historial, `interpretAssistant()` puede evolucionar hacia un payload como:

```json
{
  "comparison_id": "cmp_123",
  "consulta": "¿Y si además empiezo con papa?",
  "messages": [
    {"role": "user", "content": "¿Qué pasa si tengo 30% menos riego?"},
    {"role": "assistant", "content": "Entendí: Riego -30%. ¿Lo simulamos?"},
    {"role": "user", "content": "Sí"}
  ],
  "active_changes": [
    {"type": "irrigation", "operation": "reduce", "value": 30, "unit": "percent"}
  ]
}
```

La respuesta puede mantener el contrato actual (`understood`, `needs_clarification`, `unsupported`). No hace falta cambiar la estructura visual del drawer.
