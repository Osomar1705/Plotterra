import type { Alternative, AlternativeType, Comparison, FieldShiftApiError } from '../types/fieldshift';

const first = (obj: any, ...keys: string[]) => keys.map((k) => obj?.[k]).find((v) => v !== undefined && v !== null);
const altType = (v: unknown): AlternativeType => {
  const s = String(v ?? '').toLowerCase();
  if (['water', 'agua'].includes(s)) return 'water';
  if (['soil', 'suelo'].includes(s)) return 'soil';
  return 'economy';
};

export function normalizeAlternative(raw: any): Alternative {
  const margin = first(raw, 'margin', 'margen') ?? {};
  const water = first(raw, 'water', 'agua') ?? {};
  const soil = first(raw, 'soil', 'suelo') ?? {};
  const risk = first(raw, 'risk', 'riesgo') ?? {};
  const quality = first(raw, 'data_quality', 'dataQuality', 'calidad_datos') ?? {};
  const campaigns = first(raw, 'campaigns', 'campanas', 'campañas') ?? [];
  return {
    id: String(first(raw, 'alternative_id', 'id', 'alternativa_id') ?? crypto.randomUUID()),
    type: altType(first(raw, 'alternative_type', 'type', 'tipo')),
    campaigns: campaigns.map((c: any) => ({
      crop: String(first(c, 'crop', 'cultivo') ?? '—'),
      window: String(first(c, 'window', 'ventana', 'fecha') ?? '—'),
    })),
    margin: {
      min: Number(first(margin, 'min', 'minimo') ?? 0),
      max: Number(first(margin, 'max', 'maximo') ?? 0),
      currency: String(first(margin, 'currency', 'moneda') ?? 'PEN'),
      basis: String(first(margin, 'basis', 'base') ?? 'ha'),
    },
    water: {
      metric: String(first(water, 'metric', 'metrica') ?? 'demand'),
      value: Number(first(water, 'value', 'valor') ?? 0),
      unit: String(first(water, 'unit', 'unidad') ?? 'mm'),
    },
    soil: { compatibility: String(first(soil, 'compatibility', 'compatibilidad') ?? 'unknown') },
    risk: {
      level: String(first(risk, 'level', 'nivel') ?? 'unknown').toLowerCase() as Alternative['risk']['level'],
      mainCause: first(risk, 'main_cause', 'mainCause', 'causa_principal') ?? null,
    },
    dataQuality: {
      level: String(first(quality, 'level', 'nivel') ?? 'unknown').toLowerCase() as Alternative['dataQuality']['level'],
      mainGap: first(quality, 'main_gap', 'mainGap', 'brecha_principal') ?? null,
    },
  };
}

export function normalizeComparison(raw: any): Comparison {
  const payload = first(raw, 'comparison', 'comparacion', 'resultado') ?? raw;
  const alternatives = first(payload, 'alternatives', 'alternativas') ?? [];
  const activeChanges = first(payload, 'active_changes', 'cambios_activos', 'cambios') ?? [];
  return {
    id: String(first(payload, 'comparison_id', 'id', 'scenario_id', 'comparacion_id') ?? 'unknown'),
    plotId: String(first(payload, 'plot_id', 'parcel_id', 'parcela_id') ?? 'unknown'),
    areaHa: Number(first(payload, 'area_ha', 'areaHa') ?? 0) || undefined,
    priority: altType(first(payload, 'priority', 'prioridad')),
    status: String(first(payload, 'status', 'estado') ?? 'ready').toLowerCase() as Comparison['status'],
    activeChanges: activeChanges.map((c: any) => ({
      id: first(c, 'change_id', 'id', 'cambio_id'),
      type: String(first(c, 'type', 'tipo') ?? 'unknown'),
      operation: first(c, 'operation', 'operacion'),
      value: first(c, 'value', 'valor'),
      unit: first(c, 'unit', 'unidad'),
      label: first(c, 'label', 'etiqueta'),
    })),
    alternatives: alternatives.map(normalizeAlternative),
    sourceResult: first(payload, 'fuente_resultado', 'source_result', 'sourceResult'),
    parentComparisonId: first(payload, 'parent_comparison_id', 'comparacion_padre_id'),
    runId: first(payload, 'run_id', 'runId'),
  };
}

export function normalizeApiError(raw: any, status?: number): FieldShiftApiError {
  const e = raw?.error ?? raw ?? {};
  return {
    code: String(first(e, 'codigo', 'code') ?? `HTTP_${status ?? 500}`),
    field: first(e, 'campo', 'field') ?? null,
    technicalMessage: String(first(e, 'mensaje_tecnico', 'technical_message', 'message') ?? ''),
    farmerMessage: String(first(e, 'mensaje_agricultor', 'farmer_message', 'detail', 'message') ?? 'No pudimos completar la operación.'),
    suggestedAction: first(e, 'accion_sugerida', 'suggested_action'),
    runId: first(e, 'run_id', 'runId'),
  };
}
