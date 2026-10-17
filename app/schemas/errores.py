"""Cuerpo unico de error para todos los endpoints.

mensaje_agricultor y accion_sugerida existen para que el frontend no tenga que
inventar textos ni decidir a que campo llevar al usuario. run_id aparece en los
logs del servidor: con ese codigo se encuentra la ejecucion exacta.
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class CodigoError(str, Enum):
    POLIGONO_INVALIDO = "POLIGONO_INVALIDO"
    AREA_FUERA_DE_RANGO = "AREA_FUERA_DE_RANGO"
    FECHA_SIN_VENTANA = "FECHA_SIN_VENTANA"
    AGUA_INVALIDA = "AGUA_INVALIDA"
    CULTIVOS_INSUFICIENTES = "CULTIVOS_INSUFICIENTES"
    PRIORIDAD_INVALIDA = "PRIORIDAD_INVALIDA"
    PLAN_HABITUAL_INVALIDO = "PLAN_HABITUAL_INVALIDO"
    ENTRADA_INVALIDA = "ENTRADA_INVALIDA"
    NO_ENCONTRADO = "NO_ENCONTRADO"
    DATOS_NO_DISPONIBLES = "DATOS_NO_DISPONIBLES"
    CALCULO_EXCEDIO_TIEMPO = "CALCULO_EXCEDIO_TIEMPO"
    LLM_NO_DISPONIBLE = "LLM_NO_DISPONIBLE"
    ERROR_INTERNO = "ERROR_INTERNO"


class AccionSugerida(str, Enum):
    redibujar_parcela = "redibujar_parcela"
    editar_area = "editar_area"
    editar_fecha = "editar_fecha"
    editar_agua = "editar_agua"
    editar_cultivos = "editar_cultivos"
    editar_prioridad = "editar_prioridad"
    editar_plan_habitual = "editar_plan_habitual"
    editar_suelo = "editar_suelo"
    usar_parcela_demostrativa = "usar_parcela_demostrativa"
    reintentar = "reintentar"
    reformular_pregunta = "reformular_pregunta"
    ninguna = "ninguna"


class DetalleError(BaseModel):
    codigo: CodigoError
    campo: str | None = Field(default=None, description="Campo de la entrada que fallo, en notacion de punto.")
    mensaje_tecnico: str = Field(description="Para los logs y para el equipo.")
    mensaje_agricultor: str = Field(description="Texto listo para mostrar en pantalla.")
    accion_sugerida: AccionSugerida
    run_id: str = Field(description="Aparece en los logs del servidor.")


class RespuestaError(BaseModel):
    error: DetalleError
