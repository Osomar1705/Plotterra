import type { AppliedChange, AssistantInterpretation, Comparison, EntryConditions, Plot, PlotDraft, AlternativePassport } from '../types/fieldshift';
import { normalizeApiError, normalizeComparison } from './normalizers';
import { baseComparison, changedComparison, demoPlot } from '../mocks/data';
import { polygonAreaHa } from '../lib/plotGeometry';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
const USE_MOCKS = String(import.meta.env.VITE_USE_LOCAL_MOCKS ?? 'true') === 'true';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// La demo mantiene la misma prioridad, parcela y escenario entre las tres rutas.
const DEMO_KEY = 'fieldshift.demo.comparison.';
function rememberComparison(c: Comparison): Comparison {
  try { sessionStorage.setItem(DEMO_KEY+c.id, JSON.stringify(c)); } catch { /* storage no disponible */ }
  return c;
}
function storedComparison(id: string): Comparison | null {
  try { const json=sessionStorage.getItem(DEMO_KEY+id); return json?JSON.parse(json) as Comparison:null; } catch { return null; }
}

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw normalizeApiError(data, res.status);
  return data;
}

/**
 * Vista 01 -> POST /parcelas. El backend valida el poligono, calcula el area y
 * devuelve datos ambientales sugeridos que el agricultor puede corregir.
 * Acepta parcela sin geometria cuando el agricultor escribe las hectareas.
 */
export async function createPlot(draft: PlotDraft): Promise<Plot> {
  if (USE_MOCKS) {
    await sleep(500);
    return {
      ...demoPlot,
      locality: draft.locality || demoPlot.locality,
      // Respetamos el poligono dibujado para que el area mostrada en Vista 01
      // sea la misma que viaja a Vista 02 tambien en modo mock.
      areaHa: draft.declaredAreaHa ?? (draft.points.length >= 3 ? Number(polygonAreaHa(draft.points).toFixed(2)) : demoPlot.areaHa),
    };
  }
  const body = {
    geometria: draft.points.length >= 3
      ? { type: 'Polygon', coordinates: [[...draft.points.map((p) => [p.x, p.y]), [draft.points[0].x, draft.points[0].y]]] }
      : null,
    area_declarada_ha: draft.declaredAreaHa ?? null,
    localidad: draft.locality ?? null,
  };
  const raw = await request('/parcelas', { method: 'POST', body: JSON.stringify(body) });
  const s = raw?.sugerencias ?? raw?.suggestions ?? {};
  return {
    id: String(raw?.parcela_id ?? raw?.plot_id ?? raw?.id ?? ''),
    areaHa: Number(raw?.area_ha ?? raw?.areaHa ?? draft.declaredAreaHa ?? 0),
    locality: raw?.localidad ?? raw?.locality,
    cellId: raw?.celda_id ?? raw?.cell_id,
    suggestions: {
      rainfallMm: s?.lluvia_media_campania_mm?.valor ?? s?.rainfall_mm,
      rainfallSource: s?.lluvia_media_campania_mm?.fuente ?? s?.rainfall_source,
      soilTexture: s?.suelo?.textura ?? s?.soil?.texture,
      fieldCapacityMm: s?.suelo?.capacidad_campo_mm ?? s?.soil?.field_capacity_mm,
      soilSource: s?.suelo?.fuente ?? s?.soil?.source,
      soilUncertainty: s?.suelo?.incertidumbre ?? s?.soil?.uncertainty,
    },
  };
}

export async function createComparison(conditions: EntryConditions): Promise<Comparison> {
  if (USE_MOCKS) { await sleep(450); return rememberComparison({...baseComparison, plotId: conditions.plotId ?? baseComparison.plotId, areaHa: conditions.areaHa ?? baseComparison.areaHa, priority: conditions.priority ?? baseComparison.priority}); }
  return normalizeComparison(await request('/comparaciones', { method:'POST', body: JSON.stringify(conditions) }));
}

export async function getComparison(id: string): Promise<Comparison> {
  if (USE_MOCKS) { await sleep(250); return storedComparison(id) ?? (id.includes('riego') ? changedComparison : baseComparison); }
  return normalizeComparison(await request(`/comparaciones/${encodeURIComponent(id)}`));
}

export async function applyChange(comparisonId: string, change: AppliedChange): Promise<Comparison> {
  if (USE_MOCKS) {
    await sleep(1100);
    if (change.type !== 'irrigation' || Number(change.value) !== 30) throw {code:'DEMO_UNAVAILABLE',farmerMessage:'El modo demostración solo tiene resultados para 30% menos riego.'};
    const current=storedComparison(comparisonId) ?? baseComparison;
    const next={...changedComparison, plotId:current.plotId, areaHa:current.areaHa, priority:current.priority, parentComparisonId:current.id};
    return rememberComparison(next);
  }
  return normalizeComparison(await request(`/comparaciones/${encodeURIComponent(comparisonId)}/cambios`, {
    method:'POST', body: JSON.stringify({ cambio: change })
  }));
}

export async function undoChange(comparison: Comparison): Promise<Comparison> {
  const change = comparison.activeChanges.at(-1);
  if (USE_MOCKS) { await sleep(500); return storedComparison(comparison.parentComparisonId ?? 'cmp_demo_base') ?? baseComparison; }
  if (!change?.id) {
    if (comparison.parentComparisonId) return getComparison(comparison.parentComparisonId);
    throw { code:'NO_CHANGE_ID', farmerMessage:'No se pudo identificar el cambio que se desea deshacer.' };
  }
  const data = await request(`/comparaciones/${encodeURIComponent(comparison.id)}/cambios/${encodeURIComponent(change.id)}`, { method:'DELETE' });
  if (data) return normalizeComparison(data);
  if (comparison.parentComparisonId) return getComparison(comparison.parentComparisonId);
  return getComparison(comparison.id);
}

export async function interpretAssistant(comparisonId: string, message: string): Promise<AssistantInterpretation> {
  if (USE_MOCKS) {
    await sleep(450);
    if (/riego|agua/i.test(message)) return { status:'understood', intent:'modify_scenario', change:{type:'irrigation',operation:'reduce',value:30,unit:'percent',label:'Riego −30%'}, needsConfirmation:true };
    return { status:'needs_clarification', clarification:'¿Quieres cambiar el riego, excluir un cultivo o modificar el cultivo inicial?' };
  }
  const raw = await request('/consultas', { method:'POST', body: JSON.stringify({ comparison_id:comparisonId, consulta:message }) });
  const status = raw?.status ?? raw?.estado ?? (raw?.change || raw?.cambio ? 'understood' : 'needs_clarification');
  const c = raw?.change ?? raw?.cambio;
  return {
    status,
    intent: raw?.intent ?? raw?.intencion,
    change: c ? { id:c.id, type:c.type ?? c.tipo, operation:c.operation ?? c.operacion, value:c.value ?? c.valor, unit:c.unit ?? c.unidad, label:c.label ?? c.etiqueta } : undefined,
    needsConfirmation: raw?.needs_confirmation ?? raw?.requiere_confirmacion ?? true,
    clarification: raw?.clarification ?? raw?.aclaracion ?? raw?.mensaje,
  };
}


export async function getAlternativePassport(comparisonId: string, alternativeId: string): Promise<AlternativePassport> {
  if (USE_MOCKS) {
    await sleep(350);
    const comparison = storedComparison(comparisonId) ?? (comparisonId.includes('riego') ? changedComparison : baseComparison);
    const alt = comparison.alternatives.find((item) => item.id === alternativeId) ?? comparison.alternatives[0];
    return {
      alternativeId: alt.id, sourceResult: 'mock', engineVersion: 'demo-1.0', datasetVersion: 'hackathon-2026',
      metrics: [
        {id:'margin',label:'Margen estimado',value:`S/ ${alt.margin.min?.toLocaleString('es-PE')} – ${alt.margin.max?.toLocaleString('es-PE')}`,definition:'Rango estimado para el horizonte de la ruta.',source:'Motor FieldShift',status:'Demostración'},
        {id:'water',label:'Demanda de agua',value:alt.water.value,unit:alt.water.unit,definition:'Indicador hídrico agregado de la ruta.',source:'Datos climáticos + motor FieldShift',status:'Demostración'},
        {id:'soil',label:'Compatibilidad de rotación',value:alt.soil.compatibility,definition:'Compatibilidad agronómica de la secuencia.',source:'Reglas agronómicas FieldShift',status:'Demostración'},
      ],
      sources:['NASA GPM / datos climáticos usados por el proyecto','Datos agrícolas y condiciones ingresadas para la parcela'],
      assumptions:['Los valores mock sirven para demostrar la interfaz y deben sustituirse por resultados del backend.','La herramienta orienta la comparación; no reemplaza el criterio del agricultor.'],
    };
  }
  const raw = await request(`/comparaciones/${encodeURIComponent(comparisonId)}/alternativas/${encodeURIComponent(alternativeId)}/pasaporte`);
  const metrics = raw?.metrics ?? raw?.metricas ?? [];
  return { alternativeId, sourceResult:raw?.source_result ?? raw?.fuente_resultado, engineVersion:raw?.engine_version ?? raw?.version_motor, datasetVersion:raw?.dataset_version ?? raw?.version_datos, metrics:metrics.map((m:any,i:number)=>({id:String(m.id??i),label:m.label??m.nombre??'Indicador',value:m.value??m.valor??null,unit:m.unit??m.unidad,definition:m.definition??m.definicion,source:m.source??m.fuente,status:m.status??m.estado??'Disponible'})), sources:raw?.sources??raw?.fuentes??[], assumptions:raw?.assumptions??raw?.supuestos??[] };
}

export function isUsingMocks() { return USE_MOCKS; }
