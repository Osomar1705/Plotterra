-- Estado del servicio. Sin ORM: cuatro tablas y consultas explicitas.
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS sesiones (
    sesion_id      TEXT PRIMARY KEY,
    creada_en      TEXT NOT NULL,
    ultimo_acceso  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parcelas (
    parcela_id        TEXT PRIMARY KEY,
    sesion_id         TEXT NOT NULL REFERENCES sesiones(sesion_id),
    geometria_geojson TEXT,
    area_ha           REAL NOT NULL,
    celda_id          TEXT NOT NULL,
    localidad         TEXT NOT NULL,
    origen_area       TEXT NOT NULL,
    creada_en         TEXT NOT NULL
);

-- Procedencia y reproducibilidad: con una fila de esta tabla se puede repetir
-- cualquier resultado de la demo.
CREATE TABLE IF NOT EXISTS ejecuciones (
    comparacion_id   TEXT PRIMARY KEY,
    parcela_id       TEXT NOT NULL REFERENCES parcelas(parcela_id),
    condiciones_json TEXT NOT NULL,
    derivada_de      TEXT,
    cambios_json     TEXT NOT NULL DEFAULT '[]',
    version_motor    TEXT NOT NULL,
    semilla          INTEGER NOT NULL,
    version_datasets TEXT NOT NULL,
    duracion_ms      INTEGER,
    estado           TEXT NOT NULL,
    clave_cache      TEXT,
    creada_en        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_ejecuciones_cache ON ejecuciones(clave_cache);
CREATE INDEX IF NOT EXISTS ix_ejecuciones_parcela ON ejecuciones(parcela_id);

-- Evita recalcular al abrir el pasaporte o volver a la comparacion.
CREATE TABLE IF NOT EXISTS resultados (
    comparacion_id TEXT NOT NULL REFERENCES ejecuciones(comparacion_id),
    alternativa_id TEXT NOT NULL,
    metricas_json  TEXT NOT NULL,
    secuencia_json TEXT NOT NULL,
    PRIMARY KEY (comparacion_id, alternativa_id)
);

-- La respuesta completa, indexada por la clave de cache.
CREATE TABLE IF NOT EXISTS respuestas (
    comparacion_id TEXT PRIMARY KEY REFERENCES ejecuciones(comparacion_id),
    cuerpo_json    TEXT NOT NULL,
    guardada_en    TEXT NOT NULL
);
