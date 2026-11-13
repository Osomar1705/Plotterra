import type { AlternativePassport, AppliedChange, AssistantInterpretation, Comparison, EntryConditions, Greenness, Plot, PlotDraft } from '../types/fieldshift';
import { normalizeAlternativePassport, normalizeApiError, normalizeComparison } from './normalizers';
import { baseComparison, changedComparison, demoPassports, demoPlot } from '../mocks/data';
import { polygonAreaHa } from '../lib/plotGeometry';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
const USE_MOCKS = String(import.meta.env.VITE_USE_LOCAL_MOCKS ?? 'true') === 'true';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Indica si la app corre contra datos locales. Las vistas lo usan para decidir
 * si pueden abrirse sin un comparisonId real en la URL.
 */
export function isUsingMocks(): boolean {
  return USE_MOCKS;
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
  if (USE_MOCKS) { await sleep(450); return {...baseComparison, plotId: conditions.plotId ?? baseComparison.plotId, areaHa: conditions.areaHa ?? baseComparison.areaHa, priority: conditions.priority ?? baseComparison.priority}; }
  return normalizeComparison(await request('/comparaciones', { method:'POST', body: JSON.stringify(conditions) }));
}

export async function getComparison(id: string): Promise<Comparison> {
  if (USE_MOCKS) { await sleep(250); return id.includes('riego') ? changedComparison : baseComparison; }
  return normalizeComparison(await request(`/comparaciones/${encodeURIComponent(id)}`));
}

export async function applyChange(comparisonId: string, change: AppliedChange): Promise<Comparison> {
  if (USE_MOCKS) { await sleep(1100); return changedComparison; }
  return normalizeComparison(await request(`/comparaciones/${encodeURIComponent(comparisonId)}/cambios`, {
    method:'POST', body: JSON.stringify({ cambio: change })
  }));
}

export async function undoChange(comparison: Comparison): Promise<Comparison> {
  const change = comparison.activeChanges.at(-1);
  if (USE_MOCKS) { await sleep(500); return baseComparison; }
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

/**
 * Vista 03 -> GET /comparaciones/{id}/alternativas/{id}/pasaporte.
 * Trazabilidad de una alternativa: de donde sale cada indicador, con sus
 * fuentes y supuestos, para que el agricultor pueda auditar la recomendacion.
 */
export async function getAlternativePassport(comparisonId: string, alternativeId: string): Promise<AlternativePassport> {
  if (USE_MOCKS) {
    await sleep(400);
    const demo = demoPassports[alternativeId];
    if (demo) return demo;
    // Sin pasaporte de demo devolvemos la envoltura vacia: la vista ya sabe
    // mostrar "el backend no devolvio el desglose" en lugar de romperse.
    return { alternativeId, comparisonId, sourceResult: 'mock', metrics: [], sources: [], assumptions: [] };
  }
  const raw = await request(
    `/comparaciones/${encodeURIComponent(comparisonId)}/alternativas/${encodeURIComponent(alternativeId)}/pasaporte`,
  );
  return normalizeAlternativePassport(raw, alternativeId);
}


/**
 * Verdor de la parcela visto desde satelite (NDVI de NASA HLS). Confirma que el
 * terreno es una chacra. Devuelve null en modo mock o si falla: es un dato que
 * acompana la comparacion, nunca la bloquea.
 */
export async function getGreenness(plotId: string): Promise<Greenness | null> {
  if (USE_MOCKS || !plotId) return null;
  try {
    const raw = await request(`/parcelas/${encodeURIComponent(plotId)}/verdor`);
    return {
      available: Boolean(raw?.disponible),
      reason: raw?.motivo,
      farmerMessage: String(raw?.mensaje_agricultor ?? ''),
      pattern: raw?.patron,
      series: (raw?.serie ?? []).map((p: any) => ({ date: String(p.fecha), ndvi: Number(p.ndvi) })),
      monthly: (raw?.ciclo_tipico ?? []).map((m: any) => ({ month: Number(m.mes), ndvi: Number(m.ndvi_medio) })),
      clearImages: raw?.imagenes_despejadas,
      scenes: raw?.escenas_revisadas,
      lastYear: raw?.ultimos_12_meses
        ? { min: raw.ultimos_12_meses.ndvi_min, max: raw.ultimos_12_meses.ndvi_max, images: raw.ultimos_12_meses.imagenes }
        : undefined,
      source: raw?.fuente,
    };
  } catch {
    return null;
  }
}
