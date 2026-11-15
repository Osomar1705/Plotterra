# Acercamiento de cámara · Plotterra

Base remota comprobada: `799d3ed` de `main`, 15 de noviembre de 2026.
Rama de entrega: `feat/acercamiento-3d`. Incluye el bloque de movimiento suave
anterior, más esta corrección. No se hizo push.

## Dónde está

Al enviar la parcela con **Compare my options**, y al recalcular desde la guía,
la pantalla existente de simulación muestra un campo tridimensional. La cámara
avanza hacia él, gira suavemente hasta la vista superior y da paso a las cien
celdas de resultados. Abrir una comparación ya existente con `comparisonId`
conserva el comportamiento previo: no reproduce la introducción.

La cámara dura 2,2 segundos. El botón **See results →** y Escape permiten saltarla
en cuanto existen resultados. Después del acercamiento, las celdas y el resumen
conservan su tiempo de lectura, aproximadamente 1,75 segundos para 100 datos.
Si el servicio tarda más, se espera su respuesta: no se crean resultados ni se
presenta la cámara como un porcentaje de cálculo.

## Qué cambió

La corrección sustituye la inclinación de un plano por una cámara en perspectiva
que se aproxima más del doble a una geometría con suelo, surcos y plantas. Es una
miniatura agrícola ilustrativa, no un levantamiento 3D del terreno dibujado, ni
una escena fotorealista equivalente a la producción original de Resn.

El render principal es WebGL nativo, con una malla estática y una llamada de
dibujo. Si no está disponible, Canvas 2D proyecta la misma cámara y geometría con
menos plantas y un máximo de 24 frames por segundo. Si tampoco funciona Canvas,
queda una transición CSS; la cuadrícula y sus datos siguen siendo accesibles.
No se añadieron librerías, imágenes de terceros, dependencias ni descargas.

La escena se encuadra según el espacio disponible. La resolución se limita a
1,5× en móvil para WebGL y 1,25× para Canvas. Al terminar el recorrido deja de
renderizar; al ocultar la pestaña cancela el frame pendiente. Se eliminan
listeners, observadores, buffers y shaders al desmontar. Con movimiento reducido
se omite la cámara y se respeta el acceso directo a los resultados.

El diálogo conserva el foco de teclado y un objetivo de 44 px para continuar.
No se añadieron textos, lemas, instrucciones, controles ni opciones al producto.
El mapa, los cálculos, la guía y los contratos permanecen intactos.

## Verificación

- `npm run build` con `VITE_USE_LOCAL_MOCKS=false`: correcto.
- `npm run test:guide`: 22 pruebas; incluye 5 sobre el acercamiento, proyección,
  encuadre de esquinas, estabilidad de la cámara y coincidencia con la cuadrícula.
- `node tests/drawing/run.mjs`: 25 pruebas de geometría y puntero correctas.
- `git diff --check`: correcto.
- Navegador: recorrido de parcela a opciones, escena, resultados y foco de teclado.
- Anchos 320 y 360 px en iframe: sin desborde horizontal; botón de 44 px visible.
  No equivale a probar un teléfono físico.
- El navegador de revisión no dispone de WebGL: se comprobó visualmente Canvas,
  que reproduce la cámara y el volumen. La ruta GPU compila, pero no se validó
  visualmente en ese navegador. No se promete una cifra de FPS en móviles reales.
- QA visual con mocks explícitos fuera del paquete. El build usa conexión real;
  no se cambia `.env.local`, ni se oculta un fallo del servicio con datos demo.
- Se mantiene el aviso existente de Vite por el tamaño del JavaScript global.
- Sin cambios en backend, API, tipos, normalizadores, integración ni lockfile.

## El aviso de conexión de la captura

**We couldn't reach FieldShift** significa que la petición al servicio falló.
Ocurre antes de llegar a la comparación. Por sí solo no demuestra si el backend
está apagado, tiene otra dirección o existe un bloqueo de red.

`npm run dev` arranca Vite y el servidor de la guía; no arranca FastAPI. El backend
local documentado usa `http://127.0.0.1:8000/api/v1`. Para comprobarlo en PowerShell:

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/health' -TimeoutSec 10
```

Si no responde y usas el backend local, en **otra terminal** con la venv existente:

```powershell
Set-Location 'C:\Users\Valentino\Documents\NSC_Hack\Plotterra\backend'
$env:FIELDSHIFT_MOTOR = 'real'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Si esa venv todavía no existe, el README del backend requiere Python 3.11:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:FIELDSHIFT_MOTOR = 'real'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Si utilizas un backend desplegado, comprueba su URL configurada; este paquete no
la sustituye. No compartas claves ni el contenido de tus archivos de entorno.

## Referencias

Corn Revolution mostró un aviso de navegador incompatible durante la revisión;
no se afirma haber inspeccionado su sección Testing en funcionamiento. Su autor
sí documenta una experiencia 3D en tiempo real. Se adapta el recorrido de cámara,
no sus modelos, recursos ni una navegación que obligue a recorrer una historia.
Tend y Farm Minerals orientan el contexto agrícola y la continuidad visual.

- https://cornrevolution.resn.global/#testing
- https://baderrutter.com/news/signaling-a-new-era-corn-seed-in-3d
- https://www.tend.com/es-es
- https://www.farmminerals.com/
- https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- https://motion.dev/docs/react-accessibility
