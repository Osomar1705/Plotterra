# Fuentes de los datasets

Paquete `datos-1.0` (29/10/2026). El detalle por variable esta en `fuentes.csv`.

| Archivo | Fuente | Nota |
| --- | --- | --- |
| `clima_diario.parquet` | NASA POWER + IMERG, llevados a la altura de las chacras | 84 distritos x 4.748 dias (2013-2025) |
| `lluvia_chirps_mensual.csv` | CHIRPS | Lluvia recomendada para escenarios |
| `suelo_distritos.csv` | ISRIC SoilGrids 2.0, solo superficie agricola MNSA 2024 | 0-30 cm, con rango de incertidumbre |
| `celdas_distritos.geojson` | Limites distritales INEI + MIDAGRI MNSA 2024 | 84 celdas con altura de chacras |
| `oni_mensual.csv` | NOAA ONI | Para escenarios de El Nino |
| `parcela_demo/` | Chacra de ejemplo en Ambo, con NDVI de NASA HLS | Para la demostracion |
| `verdor_distritos.json` | NASA HLS v2.0 (Landsat 8/9 + Sentinel-2, 30 m), pixeles agricolas MNSA 2024 | 84 distritos, 2015-2026: ciclo tipico del verdor, meses verdes y secos |
| `ecostress_ambo.json` | NASA ECOSTRESS v002 L4T ESI, 70 m | 8 chacras de Ambo + la de ejemplo, 2018-2026: estres de la vegetacion por mes |

`verdor_distritos.json` y `ecostress_ambo.json` los genera
`fieldshift_datos/scripts/verdor_estres_backend.py`. Son contexto del distrito
(evidencia del calendario y del estiaje), no entran al calculo del rendimiento:
medido contra la ENA, el verdor solo se relaciona con el rendimiento en papa.

Todo el clima y el suelo se calcularon **solo sobre la superficie agricola** de
cada distrito, no sobre cerros y puna. Sin eso el simulador contaria heladas de
mas: en papa, 14 dias en lugar de 6.

**Lo que sigue siendo provisional:** las fichas de cultivo (Kc, Ky, duracion,
ventanas de siembra) y los costos de campania, en `cultivos.json`. Las ventanas
pueden salir de la ENA.
