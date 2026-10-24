import type { AppliedChange, AssistantInterpretation, Comparison, EntryConditions } from '../types/fieldshift';
import { normalizeApiError, normalizeComparison } from './normalizers';
import { baseComparison, changedComparison } from '../mocks/data';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
const USE_MOCKS = String(import.meta.env.VITE_USE_LOCAL_MOCKS ?? 'true') === 'true';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
