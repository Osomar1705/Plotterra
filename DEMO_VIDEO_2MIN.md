# FieldShift — frontend optimizado para el video de 2 minutos

Esta variante conserva los contratos de datos/API de Vista 01 y Vista 02, pero reduce el ruido visual para la grabación de 1:08–1:40.

## Recorrido de cámara
1. Parcela: Ambo, Huánuco. Dibujar/cerrar el polígono.
2. Confirmar solo cultivo anterior, agua disponible y prioridad.
3. Comparar Economía / Agua / Suelo.
4. Abrir **Preguntar al asistente**.
5. Elegir **¿Qué pasa si tengo 30% menos riego?**.
6. Confirmar **Sí, comparar**.
7. Mostrar recálculo y explicación con cifras reales de `result`.

## Cambios aplicados
- Localidad inicial: `Ambo, Huánuco`.
- Fecha, exclusiones, mm manuales y plan habitual siguen en el estado/contrato, pero se ocultan del recorrido de demo.
- La tarjeta priorizada dice `✓ Tu prioridad`.
- Margen estimado tiene mayor jerarquía visual.
- `Ver mi plan` queda visualmente secundario; Vista 03 no forma parte del video.
- El panel inferior prioriza el asistente en vez de duplicar tres cambios rápidos.
- El asistente destaca el escenario `30% menos riego`.
- La explicación final usa las métricas recibidas en `result`: agua, margen y compatibilidad de suelo.
- El overlay de cálculo deja explícito que se recalculan Economía, Agua y Suelo.

## Nota sobre el ZIP integrado recibido
`src/features/routes/DecisionRoutesPage.tsx` referencia tipos y componentes que no vienen incluidos en el ZIP (`FanGraph`, `PeacockMark`, `AlternativePassport`, etc.). Esa carpeta no es usada por `App.tsx` actual y se excluyó del chequeo TypeScript de esta variante para que no bloquee Vista 01–02. No se eliminó el código del compañero.

## Ejecutar
```bash
npm install
npm run dev
```
Abrir la URL que indique Vite, normalmente `http://localhost:5173/`.

El proyecto usa mocks por defecto. Para Backend real, configurar `.env` según `.env.example`.
