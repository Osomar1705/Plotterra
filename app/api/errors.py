"""Catalogo de errores y los manejadores que les dan el cuerpo unico.

Todo error de este servicio sale con la misma forma: codigo, campo,
mensaje_tecnico, mensaje_agricultor, accion_sugerida y run_id.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.data.identificadores import nuevo_id
from app.schemas.errores import AccionSugerida, CodigoError, DetalleError, RespuestaError

log = logging.getLogger("fieldshift")

# Texto para el agricultor y accion por codigo. El frontend no inventa textos
# ni decide a que campo llevar al usuario: los toma de aqui.
MENSAJES: dict[CodigoError, tuple[str, AccionSugerida, int]] = {
    CodigoError.POLIGONO_INVALIDO: (
        "No pudimos leer el contorno de la parcela. Vuelve a dibujarlo, o escribe las hectareas a mano.",
        AccionSugerida.redibujar_parcela,
        422,
    ),
    CodigoError.AREA_FUERA_DE_RANGO: (
        "El area dibujada no entra en el rango que podemos evaluar. Revisa el trazo o corrige las hectareas.",
        AccionSugerida.editar_area,
        422,
    ),
    CodigoError.FECHA_SIN_VENTANA: (
        "En esa fecha no hay ningun cultivo habilitado que se pueda sembrar. Prueba con otra fecha de inicio.",
        AccionSugerida.editar_fecha,
        422,
    ),
    CodigoError.AGUA_INVALIDA: (
        "Falta decir como llega el agua a la parcela, o la lamina de riego esta fuera de rango.",
        AccionSugerida.editar_agua,
        422,
    ),
    CodigoError.CULTIVOS_INSUFICIENTES: (
        "Con un solo cultivo no se puede armar una rotacion. Habilita al menos uno mas para poder comparar.",
        AccionSugerida.editar_cultivos,
        422,
    ),
    CodigoError.PRIORIDAD_INVALIDA: (
        "Elige que quieres cuidar primero: la economia, el agua o el suelo.",
        AccionSugerida.editar_prioridad,
        422,
    ),
    CodigoError.PLAN_HABITUAL_INVALIDO: (
        "El plan habitual debe tener tres campanias con cultivos del catalogo, o quedar vacio.",
        AccionSugerida.editar_plan_habitual,
        422,
    ),
    CodigoError.ENTRADA_INVALIDA: (
        "Falta completar algun dato de la parcela antes de comparar.",
        AccionSugerida.ninguna,
        422,
    ),
    CodigoError.NO_ENCONTRADO: (
        "No encontramos esa comparacion. Vuelve a la entrada y compara de nuevo.",
        AccionSugerida.ninguna,
        404,
    ),
    CodigoError.DATOS_NO_DISPONIBLES: (
        "Todavia no tenemos datos preparados para esa zona. Puedes probar con la parcela de demostracion.",
        AccionSugerida.usar_parcela_demostrativa,
        503,
    ),
    CodigoError.CALCULO_EXCEDIO_TIEMPO: (
        "El calculo tardo mas de lo previsto. Mantuvimos el resultado anterior; puedes reintentar.",
        AccionSugerida.reintentar,
        504,
    ),
    CodigoError.LLM_NO_DISPONIBLE: (
        "El asistente no esta disponible ahora. Los controles de la pantalla hacen lo mismo.",
        AccionSugerida.reformular_pregunta,
        503,
    ),
    CodigoError.ERROR_INTERNO: (
        "Algo fallo de nuestro lado. Vuelve a intentar en un momento.",
        AccionSugerida.reintentar,
        500,
    ),
}


class ErrorFieldShift(Exception):
    """Error del dominio. Se traduce al cuerpo unico en el manejador."""

    def __init__(
        self,
        codigo: CodigoError,
        mensaje_tecnico: str,
        *,
        campo: str | None = None,
        mensaje_agricultor: str | None = None,
        accion_sugerida: AccionSugerida | None = None,
        http: int | None = None,
    ) -> None:
        texto, accion, estado = MENSAJES[codigo]
        self.codigo = codigo
        self.campo = campo
        self.mensaje_tecnico = mensaje_tecnico
        self.mensaje_agricultor = mensaje_agricultor or texto
        self.accion_sugerida = accion_sugerida or accion
        self.http = http or estado
        self.run_id = nuevo_id("run")
        super().__init__(mensaje_tecnico)

    def cuerpo(self) -> RespuestaError:
        return RespuestaError(
            error=DetalleError(
                codigo=self.codigo,
                campo=self.campo,
                mensaje_tecnico=self.mensaje_tecnico,
                mensaje_agricultor=self.mensaje_agricultor,
                accion_sugerida=self.accion_sugerida,
                run_id=self.run_id,
            )
        )


def _respuesta(err: ErrorFieldShift) -> JSONResponse:
    log.warning("run_id=%s codigo=%s campo=%s %s", err.run_id, err.codigo.value, err.campo, err.mensaje_tecnico)
    return JSONResponse(status_code=err.http, content=err.cuerpo().model_dump(mode="json"))


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(ErrorFieldShift)
    async def _dominio(_: Request, exc: ErrorFieldShift) -> JSONResponse:
        return _respuesta(exc)

    @app.exception_handler(RequestValidationError)
    async def _pydantic(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Un error de tipos de Pydantic tambien sale con el cuerpo unico, para
        # que el frontend no tenga dos formas de error que manejar.
        detalles = exc.errors()
        campo = ".".join(str(p) for p in detalles[0]["loc"][1:]) if detalles else None
        tecnico = "; ".join(f"{'.'.join(str(p) for p in d['loc'][1:])}: {d['msg']}" for d in detalles[:4])
        return _respuesta(
            ErrorFieldShift(CodigoError.ENTRADA_INVALIDA, tecnico or "entrada invalida", campo=campo)
        )

    @app.exception_handler(Exception)
    async def _inesperado(_: Request, exc: Exception) -> JSONResponse:
        err = ErrorFieldShift(CodigoError.ERROR_INTERNO, f"{type(exc).__name__}: {exc}")
        log.exception("run_id=%s error no manejado", err.run_id)
        return _respuesta(err)
