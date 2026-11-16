"""Crear la parcela: valida, calcula el area y sugiere datos revisables."""
from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.api.errors import ErrorFieldShift
from app.api.validaciones import area_hectareas, validar_area, validar_entrada_parcela, validar_poligono
from app.config import CONFIG
from app.data.repository import REPO
from app.data.verdor import SerieVerdor
from app.schemas.entrada import (
    ParcelaCreada,
    ParcelaCrear,
    SugerenciaNumerica,
    SugerenciaSuelo,
    Sugerencias,
)
from app.schemas.errores import CodigoError

router = APIRouter(tags=["parcelas"])
VERDOR = SerieVerdor(CONFIG.datasets_dir)


@router.post(
    "/parcelas",
    response_model=ParcelaCreada,
    status_code=status.HTTP_201_CREATED,
    summary="Valida el poligono, calcula el area y resuelve la celda climatica",
)
def crear_parcela(entrada: ParcelaCrear, response: Response) -> ParcelaCreada:
    validar_entrada_parcela(entrada)

    if entrada.geometria is not None:
        vertices = validar_poligono(entrada.geometria)
        area = validar_area(area_hectareas(entrada.geometria))
        lon = sum(v[0] for v in vertices) / len(vertices)
        lat = sum(v[1] for v in vertices) / len(vertices)
        celda = REPO.celda_por_punto(lon, lat)
        origen = "dibujada"
        geometria = entrada.geometria.model_dump(mode="json")
    else:
        # El agricultor que no logra dibujar escribe las hectareas: se acepta la
        # parcela sin geometria y la celda se resuelve por la localidad.
        area = validar_area(float(entrada.area_declarada_ha), campo="area_declarada_ha")
        celda = REPO.celda_por_localidad(entrada.localidad)
        origen = "declarada"
        geometria = None

    if celda is None:
        raise ErrorFieldShift(
            CodigoError.DATOS_NO_DISPONIBLES,
            "la parcela cae fuera de las celdas con datasets preparados",
            campo="geometria" if geometria else "localidad",
        )

    sesion_id = REPO.asegurar_sesion(entrada.sesion_id)
    parcela_id = REPO.guardar_parcela(
        sesion_id=sesion_id,
        geometria=geometria,
        area_ha=round(area, 2),
        celda_id=celda["celda_id"],
        localidad=celda["localidad"],
        origen_area=origen,
    )
    datasets = REPO.datasets_de(celda["celda_id"])
    response.headers["X-Sesion-Id"] = sesion_id

    return ParcelaCreada(
        parcela_id=parcela_id,
        sesion_id=sesion_id,
        area_ha=round(area, 2),
        celda_id=celda["celda_id"],
        localidad=celda["localidad"],
        origen_area=origen,
        sugerencias=Sugerencias(
            lluvia_media_campania_mm=SugerenciaNumerica(
                valor=datasets.lluvia_media_campania_mm,
                fuente=REPO.fuente_clima(celda["celda_id"]),
            ),
            suelo=SugerenciaSuelo(
                textura=datasets.suelo.textura,
                capacidad_campo_mm=datasets.suelo.capacidad_campo_mm,
                punto_marchitez_mm=datasets.suelo.punto_marchitez_mm,
                fuente=datasets.suelo.fuente,
                incertidumbre=datasets.suelo.incertidumbre,
            ),
        ),
    )


@router.get(
    "/parcelas/{parcela_id}/verdor",
    summary="Verdor (NDVI) de la parcela visto desde satelite, con su clasificacion",
)
def verdor_de_parcela(parcela_id: str) -> dict:
    """Confirma con imagenes de satelite que el terreno es una chacra.

    Si la parcela no cae sobre el punto medido responde 200 con
    disponible=false y el motivo: no es un error, es una limitacion declarada.
    """
    parcela = REPO.parcela(parcela_id)
    if parcela is None:
        raise ErrorFieldShift(
            CodigoError.NO_ENCONTRADO,
            f"parcela {parcela_id} inexistente",
            campo="parcela_id",
            mensaje_agricultor="We could not find that plot. Draw it again.",
        )
    return {"parcela_id": parcela_id, **VERDOR.para(parcela["geometria"], parcela.get("celda_id"))}
