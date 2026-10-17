# FieldShift · Backend

Servicio que recibe la parcela del agricultor, ejecuta el stress test sobre las
rotaciones posibles y devuelve tres alternativas, el pasaporte de campana y los
cambios pedidos por el chatbot.

Equipo: Osmar, Breyner y Ronald. El contrato de la API es la fuente de verdad y
solo admite campos nuevos, nunca renombrados.

## Correr en local

    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app.main:app --reload

- Contrato navegable: http://localhost:8000/docs
- Salud del servicio: http://localhost:8000/api/v1/health

## Pruebas

    pytest -q

## Reparto del codigo

Ningun bloque abre un archivo de otro. Las unicas puertas entre bloques son las
firmas de `app/engine/contrato.py`.

| Bloque | Responsable | Carpetas |
| --- | --- | --- |
| Borde HTTP, contrato y estado | Osmar | `main.py`, `api/`, `schemas/`, `data/`, `mocks/` |
| Fisica de una campana | Breyner | `engine/water.py`, `yield_.py`, `economics.py`, `soil.py` |
| Combinatoria y seleccion | Ronald | `engine/rotations.py`, `scenarios.py`, `runner.py`, `selector.py` |
| Chatbot y ensayo | Los tres | `llm/` |

Mientras un bloque no exista, su stub devuelve datos de ejemplo
deterministas y el servicio responde el contrato completo. Para enchufar el
motor real basta implementar `engine/runner.py`: no se toca `api/` ni `schemas/`.

## Variables de entorno

| Variable | Default | Para que |
| --- | --- | --- |
| `FIELDSHIFT_DB` | `datos/fieldshift.sqlite3` | Ruta del SQLite de sesiones y ejecuciones |
| `FIELDSHIFT_DATASETS` | `datasets/` | Carpeta de los datasets preparados |
| `FIELDSHIFT_MOTOR` | `mock` | `mock` usa el motor de ejemplo; `real` exige `engine/runner.py` |
| `ANTHROPIC_API_KEY` | vacio | Sin ella, `/consultas` responde con el interprete de respaldo |
