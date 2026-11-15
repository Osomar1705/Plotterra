# Movimiento de Plotterra

Ampliación posterior: [ACERCAMIENTO_3D.md](ACERCAMIENTO_3D.md). La entrada oblicua
inicial se sustituyó por una cámara y geometría tridimensionales.

Base: `main` en `799d3ed` (v9). Rama: `feat/movimiento-suave`.

La parcela, las opciones y el plan conservan sus textos, datos y controles. El
cambio afecta a la presentación: no modifica el motor ni la comunicación con él.

## Decisiones

| Referencia | Qué se adapta | Aplicación |
|---|---|---|
| Corn Revolution / Resn | Sensación de cámara y profundidad | Perspectiva limitada sobre la fotografía existente y entrada oblicua de la cuadrícula de simulación |
| Tend | Fotografía agrícola como contexto del producto | Carga gradual de la imagen, sin mover textos ni créditos |
| Farm Minerals | Movimiento corto, pausado y con continuidad | Respuestas de botones, entrada de tarjetas, selección de temporada y apertura de ayuda |

Corn Revolution mostró “This experience does not work on this browser” en la
sesión de revisión. Su técnica de 3D en tiempo real se contrastó con el caso
publicado por Bader Rutter. No se observó su sección Testing funcionando aquí.
Tend y Farm Minerals sí se abrieron e inspeccionaron en navegador.

El primer bloque utilizaba planos fotográficos y perspectiva CSS. La ampliación
actual añade una escena de geometría 3D en la simulación; véase el documento anterior. Se aprovecha Motion 14.6.0, ya instalado en el proyecto; no se
incorporan dependencias ni se exige reinstalar paquetes.

## Recorrido visual

1. **Parcela:** la foto aparece gradualmente. En equipos con mouse fino responde
   con un desplazamiento de hasta 7 px y una rotación menor de 2 grados. El texto
   y el mapa se mantienen quietos. La imagen incluye margen de recorte para que
   no aparezcan bordes vacíos al moverse.
2. **Opciones:** entrada de tarjetas en intervalos de 55 ms. El hover apenas eleva
   la tarjeta y su icono; los datos no cuentan desde cero ni cambian de orden.
3. **Plan:** el fondo de selección se desplaza entre temporadas, conservando la
   posición de botones y etiquetas. Las barras entran de forma escalonada con
   sus longitudes reales. La selección sigue anunciándose con aria-pressed.
4. **Detalle y ayuda:** apertura y cierre suaves. Los detalles siguen usando el
   elemento nativo; donde no se soporta la interpolación de altura, abren sin esa
   transición. El formulario y las llamadas de la guía no se modifican.
5. **Simulación:** el acercamiento actual dura 2,2 segundos y desemboca en la
   cuadrícula con resultados reales. Después conserva la secuencia de celdas y
   el resumen durante aproximadamente 1,75 segundos. Se puede continuar antes
   con el botón existente; la cámara no representa progreso del motor.

La animación establece el orden de lectura: contexto → alternativas → temporada
seleccionada → efectos. No añade narrativa escrita, lemas, instrucciones, opciones
ni mensajes nuevos a la interfaz. Se conserva el crédito de la fotografía.

## Teléfono y accesibilidad

- Los punteros táctiles no inclinan la imagen ni capturan el gesto de scroll.
- El desplazamiento de foto ligado al scroll baja a un máximo de 3 px en cada
  dirección con puntero grueso. No se solicita orientación del teléfono.
- La preferencia de movimiento reducido elimina parallax, perspectiva y entradas
  espaciales. Se conserva una transición de opacidad breve al cambiar de vista.
- No hay scroll artificial, pantalla de introducción ni animaciones de texto.
- La cámara no usa estado React por cada movimiento del puntero. Se mide la
  posición como máximo una vez por frame de scroll, con listeners pasivos.
- Las entradas se ejecutan una sola vez al hacerse visibles. Se conserva la
  geometría y el controlador del mapa.

## Foto

Se incluye la miniatura de 1280 px que Wikimedia sirve para la foto ya utilizada:
“Andenes de cultivo”, Jospastor / Jose Pastor, valle del Colca. Fuente y licencia
CC BY-SA 4.0 en `public/media/ATTRIBUTION.txt`. La copia local pesa unos 597 kB y
elimina la dependencia de red externa para mostrar esa cabecera. No se retocó el
contenido de la foto.

## Verificación del primer bloque

Para los controles actuales (47 pruebas), véase ACERCAMIENTO_3D.md.

- `npm run build`: correcto con el modo de backend real.
- `node tests/drawing/run.mjs`: 25 pruebas correctas.
- `npm run test:guide`: 17 pruebas correctas, incluyendo normalización y guía.
- Revisión de navegador: parcela → opciones → plan; selección de temporada;
  apertura/cierre de ayuda y datos; imagen cargada desde el propio proyecto.
- Revisión de ancho en iframes: 390 y 360 px; sin desborde horizontal; las tres
  temporadas siguen seleccionándose y el indicador termina sobre el botón
  correcto. Es una comprobación de ancho, no una prueba en teléfono físico.
- Los recorridos visuales usan mocks explícitos de QA, fuera del commit. No se
  incluye `.env.local`, la página de revisión ni datos de demostración nuevos.
- `backend/`, API, tipos, integración, modelos, configuración y lockfile intactos.
- Permanece el aviso de Vite por el tamaño del JavaScript del proyecto. No se
  hizo una medición de FPS ni una revisión física de iOS/Android.

## Fuentes consultadas

- https://cornrevolution.resn.global/#testing
- https://baderrutter.com/news/signaling-a-new-era-corn-seed-in-3d
- https://www.tend.com/es-es
- https://www.farmminerals.com/
- https://motion.dev/docs/react-accessibility
- https://motion.dev/docs/react-use-spring
- https://web.dev/articles/animations-guide
- https://developer.chrome.com/blog/styling-details
- https://commons.wikimedia.org/wiki/File:Andenes_de_cultivo.jpg
