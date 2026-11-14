import type { EntryConditions } from '../types/fieldshift';

const KEY = 'fieldshift.entryConditions';

export function saveEntryConditions(value: EntryConditions) {
  sessionStorage.setItem(KEY, JSON.stringify(value));
}

export function readEntryConditions(): EntryConditions | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as EntryConditions; } catch { return null; }
}

export function clearEntryConditions() {
  sessionStorage.removeItem(KEY);
}

/**
 * Contrato simple con Vista 01:
 *   saveEntryConditions({ plotId, areaHa, priority, ... });
 *   window.location.href = '/opciones';
 *
 * También aceptamos plotId/comparisonId por query string para integración.
 */
export function readQueryContext() {
  const p = new URLSearchParams(window.location.search);
  return {
    plotId: p.get('plotId') ?? undefined,
    comparisonId: p.get('comparisonId') ?? undefined,
  };
}
