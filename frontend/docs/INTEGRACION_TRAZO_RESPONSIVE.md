# Parcela: trazo libre y adaptación a pantalla

Rama de trabajo: `feat/parcela-trazo-responsive`.
Base revisada: `main` en `da17a9fb5f2e601a14995c43df2fab572467084e`.
Rama del compañero: `feat/fieldshift-frontend-ai` en `4fa6b6b3cedf634556df4f3c8ce425e2442ceefd`.

## Qué estaba integrado

`main` ya importó el frontend del compañero bajo `frontend/`, mediante los
commits `612248a` y `4af66fd`. Los árboles de `src/`, `server/`, `scripts/`,
`docs/`, `tests/` y los archivos de dependencias/configuración del commit raíz
`4fa6b6b` son iguales a los del commit importado `a2846d3`. Después, main
corrigió fecha, geometría del ejemplo, payload y conexiones del despliegue.

La rama pública del compañero coloca el frontend en la raíz del monorepo.
Por eso una fusión normal añadiría un segundo frontend. Se registró una fusión
`ours` para reconocer esa rama como antecesora ya integrada, conservando el
árbol completo de main. Este paso no añade su código: ese código ya está en
main, junto con las correcciones de integración. No aplicar `merge -s ours`
a futuras actualizaciones del compañero sin revisar sus diferencias.

## Qué añade esta entrega

- Clic sostenido, lápiz o dedo para seguir el borde; también permite esquinas.
- Cierre al soltar cerca del inicio, con señal visual y aviso de confirmación.
- Tolerancia a temblor leve y pequeños sobrepasos; un trazo abierto permanece
  abierto y puede continuarse. No se inventa geometría para reparar cruces.
- Deshacer la última pasada, borrar, cancelar con Escape, y distinguir entre
  dibujar y mover el mapa. Las interrupciones conservan el contorno anterior.
- El cambio de tamaño y orientación recalcula Leaflet y encuadra la parcela.
- Mapa y preguntas juntos en escritorio, mapa con altura ligada a la ventana.
- Hasta 900 px de ancho: dos pasos, “Tu parcela” y “Tu campaña”; los valores y
  el mapa permanecen montados al cambiar de paso.
- Cuatro preguntas desplegables, botones de al menos 44 px, foco visible,
  selección anunciada y fuentes locales Manrope / Source Sans 3 con licencias.
- Recuperación de fecha, riego y exclusiones que la presentación de demo ocultaba.
  La ayuda ya no flota encima del mapa ni de la acción principal en esta vista.
- Validación visible de superficie manual, fecha y límite de riego.

La guía con IA, voz y confirmación de cambios, las simulaciones de 100 futuros,
el diseño de opciones y el plan del equipo se conservan. No se sustituyeron por
las pantallas del paquete antiguo: se portaron las mejoras compatibles sobre
el producto actual.

## Límites del cambio

Sin cambios en `backend/`, `src/api/`, `src/types/`, `src/assistant/`,
`src/integration/`, mocks, servidores de IA, dependencias, Vite ni despliegue.
El cuerpo de `submit()` conserva exactamente el payload y las llamadas de main.
Los límites de parcela siguen siendo 0,05–50 ha. La simplificación del trazo
produce como máximo 256 vértices y no recorta contornos silenciosamente.

## Verificación

- `npm run build`: TypeScript y bundle correctos.
- `node tests/drawing/run.mjs`: 16 pruebas de geometría y 9 de eventos de puntero.
- `npm run test:guide`: 9 pruebas existentes correctas.
- `git diff --check`: sin errores de espacios.
- Sin modificaciones del contrato ni archivos de configuración de servicios.

Las pruebas de puntero utilizan un mapa simulado; no sustituyen probar Leaflet
en navegador y en un teléfono físico. La revisión visual de escritorio/móvil
queda pendiente. El bundle conserva el aviso de Vite por JavaScript mayor de
500 kB; este cambio no incluye la división de código del frontend completo.

## Prueba manual

1. Buscar o acercar el mapa, pulsar Dibujar y trazar un contorno cerrado.
2. Soltar cerca del inicio, comprobar la superficie y deshacer.
3. Dibujar una parte abierta, continuar desde su extremo y cerrar.
4. Cruzar el contorno, salir del mapa o cancelar una pasada: comprobar el aviso.
5. Alternar Mover mapa / Dibujar y usar zoom. Girar o redimensionar la pantalla.
6. En 360/390 px de ancho: cambiar Tu parcela / Tu campaña, completar preguntas,
   volver al mapa y comprobar que se conserva. Verificar controles sin desborde.
7. Usar la parcela de ejemplo de Ambo y comparar con el backend real; abrir
   opciones, plan y guía para comprobar el recorrido existente.

## Texto sugerido para el reporte al equipo

Integré mis mejoras sobre el main que ya incorpora la rama de frontend del equipo.
Añadí dibujo libre de parcela con cierre asistido, continuación de trazos y
Deshacer. Ajusté la altura del mapa en escritorio y separé parcela/campaña en
celular, recuperando los campos que ocultaba el modo demo. Se conserva la guía,
los 100 escenarios y la integración actual con backend. Compilación y 34 pruebas
correctas; pendiente la revisión visual en navegador y teléfono físico.
