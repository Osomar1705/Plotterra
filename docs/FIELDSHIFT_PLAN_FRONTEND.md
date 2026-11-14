# FieldShift · Plan de mejora del frontend (para implementar con IA)

> **Para la IA que implementa:** lee este documento completo antes de tocar código. Trabaja por fases, en orden. Al terminar cada fase, cumple sus criterios de aceptación y deja el proyecto compilando (`npm run build`) y funcionando en modo mock (`VITE_USE_LOCAL_MOCKS=true`) **y** contra el backend (`false`).

---

## 0. Punto de partida

| Qué | Dónde |
|---|---|
| Repo base | `FieldShift-NSC-Frontend` rama **`feat/frontend-video-final`** (React + TypeScript + Vite, sin librerías de UI) |
| Rutas | `App.tsx`: `/` Vista 01 Parcela (`EntryPage`), `/opciones` Vista 02 (`ComparisonPage`), `/plan` Vista 03 (`DecisionRoutesPage`) |
| API | `src/api/fieldshiftApi.ts` (llamadas + mocks), `src/api/normalizers.ts` (backend → UI), `src/types/fieldshift.ts` |
| Estilos | `src/styles/global.css` (tokens en `:root`: `--navy --green --water --soil --economy --mint --bg …`), `src/features/routes/decision-routes.css` |
| Fuentes | Manrope (títulos) + Source Sans 3 (texto) |
| Backend de referencia | `fieldshift_backend` (FastAPI). Ya devuelve `margin.mean`, `margin.adverse`, `campaigns[].metrics` y, por alternativa, `detalle.distribucion_margen_S_ha` (100 valores), `detalle.stress_test`, `detalle.explicacion` y `detalle.tradeoffs` |

### Reglas que NO se rompen

1. **El frontend no calcula métricas** de margen, agua, riesgo ni suelo. Solo presenta lo que envía el backend. Contar cuántos de los 100 valores son positivos es presentación y está permitido, pero si el backend envía `outcomes.wins`, se usa ese valor.
2. **Las animaciones muestran datos reales.** Nada de barras de progreso con conteos inventados: la animación arranca cuando llega la respuesta y pinta los valores reales.
3. **Contratos de API intactos.** Solo se **agregan** campos opcionales. Si un campo nuevo no llega, la UI cae con elegancia a lo que hay hoy.
4. **Los mocks deben seguir funcionando sin backend** y ser deterministas (semilla fija).
5. **Accesibilidad:**
   - Respetar `prefers-reduced-motion`: sin animación, el estado final aparece directo.
   - Nada se comunica solo con color.
   - Todo gráfico tiene un resumen en texto.
6. **Móvil:** funciona desde 360 px de ancho sin scroll horizontal.
7. **Rendimiento:** la UI responde en todo momento. Nada de WebGL ni 3D pesado. Usar SVG/CSS y una sola librería de animación.
8. **Sigue siendo software, no landing page.** El efecto wow ocurre en **momentos puntuales** (ver §2), no en cada pantalla.

---

## 1. Qué buscamos (dirección de diseño)

**Concepto:** *"Tu chacra en 100 futuros"*. El diferenciador del producto es que prueba cada rotación en 100 futuros posibles (clima histórico NASA + golpes de lluvia, riego y precio). Hoy eso solo aparece como texto de carga. Tiene que volverse **lo más visible y lo más bonito del producto**.

**Referencias acordadas por el equipo:**

| Referencia | Qué tomamos | Qué NO tomamos |
|---|---|---|
| **Tend** (tend.com, software de gestión agrícola) | Cómo **vende el producto mostrándolo**: titular de promesa corto, la interfaz real como protagonista, flujo claro tipo "Plan · Grow · Sell", tono cálido de "hecho para agricultores" | Páginas de marketing largas, precios, testimonios |
| **Pioneer – Corn Revolutionized** (Awwwards Site of the Year) | Animaciones complejas por etapas que sorprenden a primera vista; transiciones con continuidad (un elemento "viaja" de una vista a otra) | 3D/WebGL, scroll infinito de landing |
| **Farm Minerals** (caso Awwwards) | Explicar lo complejo con **un objeto tangible** en vez de diagramas abstractos (para nosotros: la parcela); "la confianza importa más que el espectáculo" | — |
| **Investigación de visualización de incertidumbre** (Kay, Kale, Hullman) | Mostrar incertidumbre como **frecuencias**: puntos discretos (quantile dotplot) o resultados animados. El público los entiende mejor que los rangos | Intervalos tipo "S/ −5 470 – 15 850" como cifra principal |

**Los 3 momentos wow (y solo esos):**

1. **La simulación** (Fase 3): 100 parcelas se pintan en vivo y luego "viajan" a las tarjetas.
2. **Mismo futuro, distinto resultado** (Fase 2): al pasar el cursor por un futuro, se ilumina ese mismo futuro en las 3 alternativas.
3. **La línea de tiempo del plan** (Fase 5): la rotación de 3 años se dibuja como surcos sobre el calendario.

**Tono visual:** se mantiene la paleta actual (verde, azul agua, teal suelo). Se agregan calidez y humanidad con ilustraciones de cultivos (Fase 4) y una o dos fotos reales del paisaje andino.

---

## 2. Viabilidad (resumen para el equipo)

| Funcionalidad | ¿Los datos ya existen? | Cambio en backend | Cambio en frontend | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| F1 · 100 parcelas | **Sí**: `detalle.distribucion_margen_S_ha` (100 valores por alternativa, mismo orden de escenarios en las tres) | Opcional: agregar metadatos por escenario (familia y años de clima) y `outcomes` (abajo) | Tipos + normalizador + componente `FuturesGrid` | Medio (≈1 día) | Bajo |
| F2 · Simulación animada | Sí (mismos datos) | Ninguno | Componente `SimulationReveal`, quitar las demoras artificiales | Medio | Medio (pulir la animación lleva tiempo) |
| F3 · Ilustraciones y fotos | No aplica | Ninguno | Set de 6 SVG + componente `CropIllustration` + 1–2 fotos | Medio | Bajo |
| F4 · Vista 03 renovada | Parcial: falta mes de siembra y cosecha explícito | Recomendado: `start_month` y `end_month` por campaña; opcional: lluvia mensual | Rediseño de `DecisionRoutesPage` | Medio–alto | Medio |
| F5 · Imagen satelital en Vista 01 | No aplica | Ninguno | Fondo estático detrás del lienzo SVG actual | Bajo | Bajo |
| F6 · Bienvenida estilo Tend (opcional) | No aplica | Ninguno | Una pantalla corta antes de Vista 01 | Bajo | Bajo |

**Conclusión:** F1 es viable ya. Los 100 valores llegan hoy en la respuesta del backend; el frontend simplemente los descarta en `normalizeAlternative()`.

---

## 3. Contrato de datos (agregar, no reemplazar)

### 3.1 Backend (si usan el backend de referencia)

**a) Metadatos de cada escenario.** En `app/engine/simulacion/puerta.py`, dentro del diccionario `"simulacion"` que arma `ejecutar_comparacion()`, agregar:

```python
"escenarios": [
    {"id": e["escenario_id"], "familia": e["familia"], "anios_clima": e["anios_clima"],
     "futuro_base": e["futuro_base"]}
    for e in esc.resumen(clima)
],
```

(`esc.resumen(clima)` ya existe en `escenarios.py`. El orden coincide con el de `distribucion_margen_S_ha`.)

**b) Resumen de resultados por alternativa.** En `app/engine/adaptador_frontend.py`, función `alternativa_a_frontend()`, agregar:

```python
dist = alt["distribucion_margen_S_ha"]
"outcomes": {
    "margin_by_scenario": dist,                       # 100 valores, S/ por ha en 3 campañas
    "wins": sum(1 for x in dist if x > 0),
    "losses": sum(1 for x in dist if x < 0),
    "mean": round(mh["economia"]["value"], -1),
    "adverse": round(mh["economia_adversa"]["value"], -1),
},
```

En `comparacion_a_frontend()`, agregar al nivel superior:

```python
"scenarios": motor["simulacion"]["escenarios"],
```

**c) (Para F4) Meses por campaña.** En cada `campaigns[i]` agregar `start_month` y `end_month` (`"2026-10"`, `"2027-03"`), calculados con `ventana_siembra`, `ciclo_dias` y el año agrícola, como ya hace `_ventana()`.

**d) (Opcional, F4) Lluvia mensual media.** Agregar `rainfall_monthly_mm`: 12 valores de agosto a julio, calculados de `clima.lluvia` agrupando por mes.

Si el equipo de backend usa otro backend, debe exponer **los mismos nombres de campo**.

### 3.2 Tipos del frontend (`src/types/fieldshift.ts`)

```ts
export type ScenarioFamily = 'tipica' | 'menos_lluvia' | 'menos_riego' | 'caida_precio' | 'combinado';

export interface ScenarioMeta {
  id: string;              // "esc_000"
  family: ScenarioFamily;
  climateYears: string[];  // ["2017-2018","2018-2019","2019-2020"]
  baseId?: string;         // futuro base del que deriva
}

export interface Outcomes {
  marginByScenario: number[];  // 100 valores, mismo orden que Comparison.scenarios
  wins?: number; losses?: number;
  mean?: number; adverse?: number;   // S/ por ha en el horizonte
}

// Agregar como OPCIONALES:
//   Alternative.outcomes?: Outcomes
//   Alternative.explanation?: { why?: string; dataThatWouldChange?: string }
//   Alternative.stressTest?: { family: ScenarioFamily; label: string; meanMargin: number; changeVsTypical: number }[]
//   Campaign.startMonth?: string; Campaign.endMonth?: string
//   Comparison.scenarios?: ScenarioMeta[]
//   Comparison.usualPlan?: Alternative
//   Comparison.rainfallMonthlyMm?: number[]
```

### 3.3 Normalizador (`src/api/normalizers.ts`)

- `normalizeAlternative`:
  - `outcomes`: leer de `raw.outcomes`; si no viene, construirlo desde `raw.detalle.distribucion_margen_S_ha` + `raw.margin.mean/adverse`.
  - `stressTest`: desde `raw.detalle.stress_test`.
  - `explanation`: desde `raw.detalle.explicacion`.
- Campañas: pasar `metrics`, `start_month` y `end_month`.
- `normalizeComparison`:
  - `scenarios`: desde `raw.scenarios` o `raw.simulacion.escenarios`.
  - `usualPlan`: desde `raw.usual_plan`.
  - `rainfallMonthlyMm`: desde `raw.rainfall_monthly_mm`.
- Todo opcional y tolerante a ausencia.

### 3.4 Mocks (`src/mocks/futures.ts`, nuevo)

Generador **determinista** (PRNG con semilla, por ejemplo mulberry32) que produce para cada alternativa mock 100 márgenes plausibles:
- Mezcla de normal + cola negativa.
- Economía con media alta y cola más ancha; Agua con media baja y estrecha; Suelo intermedia.
- Familias en el mismo orden que el backend: 40 típica, 15 de cada perturbación.
- Años de clima entre 1984 y 2023.

Engancharlo en `baseComparison` y `changedComparison`. En `changedComparison` (riego −30 %), bajar los valores de forma coherente.

---

## 4. Fases de implementación

### Fase 0 · Preparación

1. **Fijar versiones.** Hoy `package.json` usa `"latest"`, y una actualización puede romper la demo. Fijar las versiones instaladas en `package-lock.json`.
2. Instalar **una** librería de animación: `motion@14.6.0` (Motion para React; importar desde `motion/react` y verificar la ruta en su documentación).
3. **Tokens nuevos en `:root`** (validar con un simulador de daltonismo; la pérdida además lleva textura, ver F1):

```css
--gain-strong:#0F6B4F; --gain:#4FA383; --gain-soft:#BFE3D3;
--loss-strong:#B5471B; --loss:#D9875E; --loss-soft:#F3D2C0;   /* naranja tierra, no rojo puro */
--neutral-cell:#DCE3DF;
--earth:#8A5A2B; --earth-soft:#F3E9DC;                       /* calidez para ilustraciones y fondos */
```

4. Carpetas: `src/assets/crops/`, `src/assets/photos/`, `src/components/futures/`.

**Acepta si:** compila, se ve igual que antes y los mocks funcionan.

### Fase 1 · Datos (plomería)

Implementar §3.2, §3.3 y §3.4 (y §3.1 si el backend es el de referencia).

**Acepta si:**
- En modo mock y con backend, `comparison.alternatives[i].outcomes.marginByScenario.length === 100`.
- `comparison.scenarios.length === 100`.
- Si se borran esos campos de la respuesta, la UI actual sigue funcionando.

### Fase 2 · F1 "100 futuros" (prioridad máxima)

**Componente `src/components/futures/FuturesGrid.tsx`**

```ts
props: {
  values: number[];                 // 100 márgenes
  scenarios?: ScenarioMeta[];
  size: 'mini' | 'full';            // mini = dentro de la tarjeta; full = panel expandido
  order?: 'value' | 'scenario';     // value: ordenado de peor a mejor (quantile dotplot); scenario: por familia
  highlightIndex?: number | null;   // índice de escenario resaltado (compartido entre tarjetas)
  onHoverIndex?: (i: number | null) => void;
  revealed?: boolean;               // para la animación de F2
}
```

- **Forma:** cuadrícula 10 × 10 en SVG. Cada celda es una **parcelita**: cuadrado redondeado (radio 3 px) con 2–3 líneas finas de surco en tamaño `full`. Separación de 2 px. Mini: celda de 9–10 px; full: 26–30 px.
- **Color divergente:**
  - Ganancia → `--gain-soft` / `--gain` / `--gain-strong` según el tercil de ganancia.
  - Pérdida → `--loss-soft` / `--loss` / `--loss-strong` según el tercil de pérdida.
  - Entre −2 % y +2 % del máximo absoluto → `--neutral-cell`.
- **Codificación secundaria (obligatoria):** las celdas con pérdida llevan un patrón de rayado diagonal (`<pattern>` SVG), para que no dependa solo del color.
- **Orden por defecto `value`:** de izquierda a derecha y de arriba abajo, peor → mejor. Así se lee "cuántos rojos hay".
- **Interacción:** al pasar el cursor o tocar una celda aparece un tooltip con:
  - "Futuro 23 · Años de clima 1997–2000 · Menos lluvia (−30 %)"
  - "Margen: S/ −2 340 por ha en 3 campañas"
  
  y se llama a `onHoverIndex(i)`. Teclado: celdas enfocables con flechas en la vista full.
- **Accesibilidad:** `role="img"` con `aria-label` = la frase resumen, más una tabla oculta visualmente con los 100 valores (o un enlace "Ver como tabla").

**En la tarjeta (`AlternativeCard.tsx`):** reemplazar la barra del margen por:

- **Frase principal (grande):** "Gana en **77 de 100** futuros".
- **Debajo, `FuturesGrid` mini.**
- **Línea secundaria:** "Promedio S/ 6 830 /ha · En los 10 peores futuros: S/ −8 220 /ha". Es información, **no cambia la prioridad elegida por el agricultor**: la prioridad del inicio sigue destacando la tarjeta como hoy.
- **El rango P10–P90 actual pasa a texto pequeño o tooltip:** "Rango de escenarios: S/ −5 470 a 15 850".
- **Botón:** "Ver los 100 futuros" abre el panel full.

**Hover compartido (momento wow 2):** en `ComparisonPage`, estado `hoveredScenario: number | null`, que se pasa a las 3 tarjetas.
- Usar `order="scenario"` en las mini mientras hay hover, para que la misma posición sea el mismo futuro en las 3; volver a `value` al soltar. Alternativa: usar siempre `scenario` en las mini y `value` solo en el panel full. Elegir la que se lea mejor y documentarlo.
- Al resaltar un futuro, se ilumina el mismo en las 3 tarjetas (borde grueso + escala 1.3) y aparece una franja: "Mismo futuro (años 1997–2000, menos lluvia): Economía S/ −2 340 · Agua S/ 1 120 · Suelo S/ −890".

**Panel full ("Los 100 futuros de tu parcela"):** modal o drawer con:
- Las 3 alternativas lado a lado (y el plan habitual si existe).
- Un selector "Ordenar por: resultado | tipo de futuro". Por tipo de futuro, las celdas se agrupan en 5 bloques con su etiqueta: Típica 40 · Menos lluvia 15 · Menos riego 15 · Caída de precio 15 · Combinado 15.
- Debajo, el stress test (`stressTest`) como barras horizontales simples por familia.
- Texto fijo: "Cada cuadrito es un futuro posible construido con años reales de clima NASA. No es una probabilidad: es un conjunto de pruebas."

**Acepta si:**
- Las 3 tarjetas muestran 100 celdas reales.
- El conteo coincide con los datos.
- El hover compartido funciona con mouse y touch.
- Funciona en 360 px (en móvil, las mini van a ancho completo de la tarjeta).
- Sin `outcomes`, la tarjeta vuelve al diseño anterior.

### Fase 3 · F2 Simulación animada (momento wow 1)

**Componente `src/components/futures/SimulationReveal.tsx`.** Reemplaza:
- El spinner "Cargando opciones…" de la primera carga de `ComparisonPage`.
- El overlay de recálculo (`processing-overlay` con los 4 pasos temporizados).

**Secuencia (≤ 3,5 s en total, saltable con "Ver resultados" o la tecla Esc):**

1. **Mientras espera la API:** una cuadrícula de 100 parcelitas vacías (solo contorno) respira suavemente. Texto: "Probando tu parcela en 100 futuros…". *Sin* contar ni inventar progreso.
2. **Al llegar la respuesta:** las celdas se pintan en cascada (≈10–12 ms de desfase, ~1,2 s), siguiendo el orden de escenarios por familia. Un contador ("Futuro 37 · años 1997–2000 · menos lluvia") avanza con los **datos reales** de `scenarios`. Se usa la alternativa destacada por la prioridad del agricultor.
3. **Cierre:** la cuadrícula se reduce y se mueve hacia la tarjeta de la alternativa destacada (transición compartida con `layoutId` de Motion). Las otras dos tarjetas aparecen con un fade/slide escalonado.
4. **En recálculos** (por ejemplo, riego −30 %): mismo efecto, pero las celdas pasan del color anterior al nuevo, para que se vea qué futuros empeoraron. Texto: "Con 30 % menos riego: 12 futuros pasaron a pérdida".

**Quitar demoras artificiales:**
- En `ComparisonPage.recalc()`, la espera mínima de 4 800 ms se reemplaza por la duración real de la animación.
- En `EntryPage.submit()`, la de 8 900 ms se acorta a ≤ 1,5 s o se elimina, porque las comparaciones se crean en `/opciones` y el momento wow queda ahí.
- Con `prefers-reduced-motion`, sin cascada: estado final directo.

**Acepta si:**
- Ningún número de la animación es inventado.
- Si la API falla, se muestra el error actual sin quedar colgado.
- La animación se puede saltar.
- Fluida en una laptop normal y en un celular de gama media.

### Fase 4 · F3 Ilustraciones y fotos (humanizar)

**Ilustraciones de cultivos** (`src/assets/crops/*.svg` + `src/components/CropIllustration.tsx`):

- **6 piezas**, cada una con la planta y su producto:
  - papa (planta + tubérculos)
  - quinua (panoja)
  - cebada (espiga)
  - avena (panícula)
  - haba (vaina + flor)
  - tarwi (flor azul-violácea + vaina)
- **Estilo:** ilustración plana cálida, trazo orgánico, 3–4 colores por pieza tomados de la paleta (verdes + `--earth` + un acento propio por cultivo). `viewBox 0 0 96 96`, sin texto adentro, menos de 8 KB cada una.
- **Origen:** dibujarlas como SVG propio. **No** usar imágenes de stock ni íconos de otras marcas.
- **Dónde usarlas:**
  - Secuencia de cada tarjeta (reemplaza el `LeafIcon` genérico).
  - Chips de cultivos de la Vista 01.
  - Línea de tiempo y detalle de la Vista 03.
- **Mapeo:** por `crop_id` si llega; si no, por nombre normalizado (sin tildes, minúsculas: "Cebada grano" → `cebada`).

**Fotos (1–2 como máximo):**
- **Qué:** paisaje agrícola andino de la sierra central (Huánuco, Junín o similar), sin personas identificables. Fuente: **Wikimedia Commons** con licencia CC BY o CC BY-SA, o imagen NASA (Earth Observatory o Worldview, de uso libre con crédito).
- **Formato:** WebP, máximo 1600 px de ancho, menos de 250 KB.
- **Tratamiento:** duotono o degradado con la paleta, para que no parezca stock.
- **Dónde:** banda superior de la Vista 01 (detrás del título) y cabecera de la Vista 03.
- **Créditos:** obligatorios en un pie discreto ("Foto: Autor · Licencia · Fuente").

**Acepta si:** las 6 ilustraciones se ven coherentes entre sí, hay créditos de las fotos y el peso total añadido es menor a 600 KB.

### Fase 5 · F4 Vista 03 renovada ("Tu plan en el tiempo")

Hoy la Vista 03 es una cabecera, una fila de 3 pasos, una tarjeta de detalle y 4 KPIs: muy estándar. La nueva estructura:

1. **Cabecera:** foto con degradado + "Plan Economía · Quinua → Tarwi → Papa" + chip "Coincide con tu prioridad".
2. **Línea de tiempo de 3 años (momento wow 3):**
   - **Eje:** 36 meses (de ago-2026 a jul-2029) con meses abreviados y años marcados.
   - **Cultivos:** cada campaña es una **banda tipo surco**, una cinta con textura de líneas, que ocupa de `start_month` a `end_month` con su ilustración y nombre. Los huecos entre campañas se muestran como "descanso".
   - **Lluvia (opcional):** si llega `rainfallMonthlyMm`, barras suaves azules detrás de la línea con la lluvia media de cada mes. Así se ve que el cultivo cae en la temporada de lluvias.
   - **Animación al entrar:** las bandas "se siembran" de izquierda a derecha (trazo que se dibuja, ~1 s).
   - **Interacción:** clic en una banda → panel de detalle de esa campaña.
   - *Variante opcional:* un anillo circular, con cada vuelta = 1 año y los meses como un reloj, inspirado en el calendario agrícola andino. Solo si sobra tiempo; la línea es más legible.
3. **Detalle de campaña:**
   - Ilustración grande del cultivo.
   - Ventana de siembra.
   - Rendimiento, agua y margen de esa campaña (`campaigns[].metrics`, con su rango).
   - **Eliminar los textos fijos de `cropNotes`**: contradicen la posición real del cultivo y no cubren todos los cultivos. Si no hay datos, mostrar solo lo que el backend envía.
4. **"Cómo le va a este plan en 100 futuros":**
   - `FuturesGrid` full.
   - Stress test por familia.
   - Toggle "Comparar con mi plan habitual", que superpone o pone al lado la cuadrícula de `usualPlan`.
5. **Por qué este plan:** `explanation.why`, `tradeoffs` (ventajas y riesgos) y "Qué dato cambiaría la decisión", todo del backend.
6. **KPIs actuales** al final, compactos, corrigiendo la etiqueta de agua a "mm por campaña".

**Acepta si:** la línea de tiempo usa meses reales del backend (o se deduce de `window` si faltan), no hay textos que contradigan la posición del cultivo y funciona en móvil (en 360 px la línea de tiempo se desplaza horizontalmente *dentro* de su contenedor, no la página).

### Fase 6 · Opcionales (solo si F1–F5 están listas)

- **F5 · Satélite en Vista 01:** poner una imagen satelital estática de la zona de Ambo **como fondo** del lienzo SVG actual de `PlotMap` (opacidad ~0,55 y velo claro). No cambia la lógica de área. Fuente sugerida: captura de **NASA Worldview** (Landsat/HLS), con crédito "Imagen: NASA Worldview". Leyenda: "Imagen satelital de referencia de la zona".
- **F6 · Bienvenida estilo Tend:** una sola pantalla breve, que se puede saltar, con:
  - Titular de promesa ("Prueba tu siembra en 100 futuros antes de comprometer tu parcela").
  - Una cuadrícula de 100 parcelitas animada en bucle.
  - 3 pasos "Dibuja tu parcela · Prueba futuros · Decide tú".
  - Botón "Empezar".
  - **No inventar testimonios ni citas de agricultores.** Si se muestra un caso, etiquetarlo como "Caso de ejemplo (datos de demostración)".

---

## 5. Checklist final (antes de entregar)

- [ ] `npm run build` sin errores; versiones fijadas.
- [ ] Flujo completo en mock y con backend: Vista 01 → 02 → cambio de riego → Deshacer → asistente → Vista 03.
- [ ] Las 100 celdas coinciden con `distribucion_margen_S_ha` (revisar 3 valores al azar contra el JSON).
- [ ] Con `prefers-reduced-motion` no hay animaciones largas.
- [ ] Prueba de daltonismo (simulador de protanopia y deuteranopia): las pérdidas se distinguen por el rayado.
- [ ] 360 px y 1440 px sin scroll horizontal de página.
- [ ] Créditos de fotos visibles; las ilustraciones son propias.
- [ ] Sin textos o cifras que el backend no respalde.
- [ ] `README` del frontend actualizado con los componentes nuevos y los campos opcionales de la API.

---

## 6. Qué NO hacer

- WebGL, Three.js, parallax de landing o scroll-jacking.
- Rojo y verde puros como única diferencia.
- Animaciones que tarden más de 3,5 s o no se puedan saltar.
- Testimonios, logos de terceros o cifras inventadas.
- Cambiar la lógica de prioridad: la prioridad la elige el agricultor y solo destaca una tarjeta.
- Reescribir la capa API o los contratos existentes.

---

## 7. Fuentes de referencia

- Tend: https://tend.com · https://tend.com/page/how-it-works.html
- Pioneer – Corn Revolutionized (Awwwards Site of the Year): https://lbb.lbbonline.com/news/resn-and-bader-rutter-win-awwwards-site-of-the-year-for-pioneer-corn-revolutionized
- Farm Minerals (caso Awwwards): https://www.awwwards.com/farm-minerals-case-study.html
- Kay et al., *When (ish) is My Bus?* (quantile dotplots): https://vis.mit.edu/classes/6.859/readings/pdfs/Kay-WhenishIsMyBus.pdf
- Kale, Kay, Hullman, *Visual Reasoning Strategies for Effect Size Judgments and Decisions* (IEEE VIS, Best Paper): https://ar5iv.arxiv.org/html/2007.14516
- Ganadores 2025 de Space Apps (Zumorroda-X, Twisters, QUEÑARIS): https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/
