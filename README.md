# FieldShift · Backend

Un agricultor dibuja su chacra en el mapa, dice cuándo quiere sembrar y si
tiene riego. El servicio simula la campaña completa contra diez años de clima
real y devuelve **tres rotaciones comparadas**: cuánto rendiría cada una,
cuánta agua le faltaría, cuánto dinero dejaría y qué le hace al suelo.

Reto *Adapting to Our Changing Earth* · NASA Space Apps · Huánuco, Perú.

## Qué calcula, y con qué datos

No son cifras de ejemplo. Cada comparación corre un stress test de 100
escenarios sobre datos medidos:

| Dato | Fuente | Cobertura |
| --- | --- | --- |
| Clima diario | NASA POWER + IMERG, llevado a la altura de las chacras | 84 distritos × 4.748 días (2013-2025) |
| Lluvia | CHIRPS | mensual por distrito |
| Suelo | ISRIC SoilGrids 2.0, solo sobre superficie agrícola | 0-30 cm, con incertidumbre |
| Límites y chacras | INEI + MIDAGRI (Mapa Nacional de Superficie Agrícola 2024) | Huánuco completo |

La física es FAO-56 para el balance hídrico y FAO-33 para la respuesta del
rendimiento al déficit, aplicada **por etapa y de forma multiplicativa**: un
estrés en floración no se compensa con una etapa final holgada.

Una comparación tarda unos **470 ms** contra un presupuesto de 8.000.

## Correr en local

Hace falta **Python 3.11**, no el del sistema.

    uv venv --python 3.11
    .venv/bin/pip install -r requirements.txt
    FIELDSHIFT_MOTOR=real .venv/bin/python -m uvicorn app.main:app --reload

- Contrato navegable: http://localhost:8000/docs
- Salud: http://localhost:8000/api/v1/health

Con `FIELDSHIFT_MOTOR=mock` (el valor por defecto) responde el mismo contrato
con cifras de ejemplo, sin necesidad de datasets. La respuesta siempre declara
de dónde salieron sus números en `motor.fuente_resultado`: `calculado`, `cache`
o `mock`.

## Pruebas

    .venv/bin/python -m pytest -q

75 pasan. Entre ellas, `tests/caso_referencia.py`: una campaña calculada a mano
cuya aritmética está escrita paso a paso en el archivo. Los valores esperados
**no** salen del código que verifican — si salieran, la prueba pasaría con
cualquier fórmula.

## Endpoints

Todos cuelgan de `/api/v1`.

| Método y ruta | Para qué |
| --- | --- |
| `GET /health` | Estado, motor activo y celdas con cobertura |
| `GET /catalogo` | Cultivos, prioridades, unidades y límites |
| `POST /parcelas` | Registra el terreno; devuelve área, distrito y sugerencias de clima y suelo |
| `POST /comparaciones` | El cálculo: condiciones entran, tres alternativas salen |
| `GET /comparaciones/{id}` | Recupera una comparación |
| `GET /comparaciones/{id}/alternativas/{id}/pasaporte` | De dónde sale cada número |
| `POST /comparaciones/{id}/cambios` | "¿Y si llueve menos?" — recalcula derivando de otra |
| `DELETE /comparaciones/{id}/cambios/{id}` | Deshacer |
| `GET /comparaciones/{id}/datos-y-supuestos` | Fuentes, versiones y supuestos |
| `POST /consultas` | Pregunta en lenguaje natural → cambio estructurado |

### Cambios que entiende

`ajustar_riego`, `ajustar_lluvia`, `ajustar_precio`, `excluir_cultivo`,
`fijar_cultivo_campania` y `cambiar_prioridad`.

El chatbot **nunca produce una cifra de resultado**: solo propone un cambio, y
el motor recalcula. Si la API del modelo falla o no hay clave, cae a un
intérprete por reglas y el agricultor nunca se queda sin respuesta.

## Arquitectura

`app/api/` recibe y valida. `app/engine/puerta.py` es la **única** entrada al
motor, así que cambiar de motor de ejemplo a motor real es una variable de
entorno y no una edición en diez archivos de rutas. `app/data/` persiste en
SQLite y carga los datasets. `app/schemas/` es la fuente de verdad del
contrato: solo admite campos nuevos, nunca renombrados.

El motor simula **por tramos** y cachea por `(cultivo, posición, escenario)`:
1.800 simulaciones en lugar de una por rotación.

`app/api/compat.py` traduce los nombres que envía el frontend y repone el error
con nuestro formato cuando algo no valida. Los alias de salida (`campanas`,
`margen`, `status`, `tipo`) son vistas de los campos canónicos, que no cambian.

## Qué es sólido y qué no

El agua se calcula con datos medidos. **El margen no**: los precios y costos de
cinco de los seis cultivos siguen sin validar, y el error de precio puede ser
mayor que el margen mismo. La API lo declara sola en `calidad_informacion`, y
la interfaz lo muestra.

Eso es deliberado. Es preferible un número rotulado como estimado que uno
bonito sin procedencia.

Lo pendiente está en los [issues abiertos](https://github.com/fieldshift-nasa/backend/issues).

## Variables de entorno

| Variable | Default | Para qué |
| --- | --- | --- |
| `FIELDSHIFT_MOTOR` | `mock` | `real` usa el motor de verdad; `mock`, cifras de ejemplo |
| `FIELDSHIFT_DB` | `datos/fieldshift.sqlite3` | SQLite de sesiones y ejecuciones |
| `FIELDSHIFT_DATASETS` | `datasets/` | Carpeta de datasets |
| `FIELDSHIFT_PRESUPUESTO_MS` | `8000` | Techo de cálculo antes de rendirse |
| `FIELDSHIFT_MODELO_LLM` | `claude-opus-5-5` | Modelo del chatbot |
| `ANTHROPIC_API_KEY` | — | Sin ella, `/consultas` usa el intérprete por reglas |

Las fuentes de cada dataset están en [`datasets/FUENTES.md`](datasets/FUENTES.md).
