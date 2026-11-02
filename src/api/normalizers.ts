import type {
  Alternative,
  AlternativeKind,
  AlternativeType,
  AlternativePassport,
  Campaign,
  Comparison,
  FieldShiftApiError,
  MetricStatus,
  MetricValue,
  PassportMetric,
} from '../types/fieldshift';

const first = (obj: any, ...keys: string[]) => keys.map((k) => obj?.[k]).find((v) => v !== undefined && v !== null);
const altType = (v: unknown): AlternativeKind => {
  const s = String(v ?? '').toLowerCase();
  if (['water', 'agua'].includes(s)) return 'water';
  if (['soil', 'suelo'].includes(s)) return 'soil';
  if (['economy', 'economia', 'economía'].includes(s)) return 'economy';
  // Sin criterio reconocible preferimos 'unknown' antes que asumir 'economy':
  // la vista avisa al agricultor en lugar de etiquetar mal la alternativa.
  return 'unknown';
};

/** Numero opcional: devuelve null en vez de 0 cuando el dato no vino. */
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
};

const metricStatus = (raw: any, value: unknown): MetricStatus => {
  const s = String(first(raw, 'status', 'estado') ?? '').toLowerCase();
  if (['available', 'disponible', 'ok'].includes(s)) return 'available';
  if (['provisional', 'preliminar'].includes(s)) return 'provisional';
  if (['mock', 'demo', 'demostracion', 'demostración'].includes(s)) return 'mock';
  if (['unavailable', 'no_disponible', 'sin_dato'].includes(s)) return 'unavailable';
  // Sin estado explicito lo deducimos del valor.
  return value === null || value === undefined ? 'unavailable' : 'available';
};

function normalizeMetric(raw: any): MetricValue | undefined {
  if (raw === null || raw === undefined) return undefined;
  // El backend puede mandar el indicador como numero suelto o como objeto.
  if (typeof raw === 'number' || typeof raw === 'string') {
    return { value: typeof raw === 'number' ? raw : (num(raw) ?? raw), status: 'available' };
  }
  const value = first(raw, 'value', 'valor');
  const parsed = typeof value === 'string' && num(value) === null ? value : num(value);
  return {
    label: str(first(raw, 'label', 'etiqueta')),
    value: parsed ?? null,
    unit: str(first(raw, 'unit', 'unidad')),
    status: metricStatus(raw, parsed),
    period: str(first(raw, 'period', 'periodo', 'período')),
  };
}

function normalizeCampaign(raw: any): Campaign {
  const metrics = first(raw, 'metrics', 'indicadores', 'metricas', 'métricas');
  const mapped = metrics
    ? {
        yield: normalizeMetric(first(metrics, 'yield', 'rendimiento')),
        water: normalizeMetric(first(metrics, 'water', 'agua')),
        economy: normalizeMetric(first(metrics, 'economy', 'economia', 'economía')),
        soil: normalizeMetric(first(metrics, 'soil', 'suelo')),
      }
    : undefined;
  // Si ninguno de los cuatro vino, dejamos metrics sin definir para que la vista
  // muestre su mensaje de "sin desglose" en lugar de cuatro celdas vacias.
  const hasAny = mapped && Object.values(mapped).some((m) => m !== undefined);
  return {
    id: str(first(raw, 'campaign_id', 'id', 'campana_id', 'campaña_id')),
    crop: String(first(raw, 'crop', 'cultivo') ?? '—'),
    window: String(first(raw, 'window', 'ventana', 'fecha') ?? '—'),
    metrics: hasAny ? mapped : undefined,
  };
}

/**
 * La prioridad la elige el agricultor, asi que siempre es un criterio concreto.
 * A diferencia del tipo de alternativa, aqui 'unknown' no es un valor valido.
 */
const priorityType = (v: unknown): AlternativeType => {
  const kind = altType(v);
  return kind === 'unknown' ? 'economy' : kind;
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
    name: str(first(raw, 'name', 'nombre')),
    campaigns: campaigns.map(normalizeCampaign),
    margin: {
      min: num(first(margin, 'min', 'minimo', 'mínimo')),
      max: num(first(margin, 'max', 'maximo', 'máximo')),
      currency: String(first(margin, 'currency', 'moneda') ?? 'PEN'),
      basis: String(first(margin, 'basis', 'base') ?? 'ha'),
      period: str(first(margin, 'period', 'periodo', 'período')),
    },
    water: {
      metric: String(first(water, 'metric', 'metrica', 'métrica') ?? 'demand'),
      value: num(first(water, 'value', 'valor')),
      unit: String(first(water, 'unit', 'unidad') ?? 'mm'),
      period: str(first(water, 'period', 'periodo', 'período')),
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
    priority: priorityType(first(payload, 'priority', 'prioridad')),
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
    engineVersion: str(first(payload, 'engine_version', 'engineVersion', 'version_motor')),
    datasetVersion: str(first(payload, 'dataset_version', 'datasetVersion', 'version_datos')),
  };
}

export function normalizeAlternativePassport(raw: any, alternativeId: string): AlternativePassport {
  const payload = first(raw, 'passport', 'pasaporte') ?? raw ?? {};
  const metrics = first(payload, 'metrics', 'indicadores') ?? [];
  const sources = first(payload, 'sources', 'fuentes') ?? [];
  const assumptions = first(payload, 'assumptions', 'supuestos', 'limitaciones') ?? [];
  const toList = (v: any): string[] =>
    (Array.isArray(v) ? v : [v]).map((item) => str(typeof item === 'string' ? item : first(item, 'label', 'etiqueta', 'name'))).filter((s): s is string => Boolean(s));
  return {
    alternativeId: String(first(payload, 'alternative_id', 'alternativeId', 'alternativa_id') ?? alternativeId),
    comparisonId: str(first(payload, 'comparison_id', 'comparisonId', 'comparacion_id')),
    sourceResult: str(first(payload, 'fuente_resultado', 'source_result', 'sourceResult')),
    engineVersion: str(first(payload, 'engine_version', 'engineVersion', 'version_motor')),
    datasetVersion: str(first(payload, 'dataset_version', 'datasetVersion', 'version_datos')),
    metrics: (Array.isArray(metrics) ? metrics : []).map((m: any, i: number): PassportMetric => {
      const value = first(m, 'value', 'valor');
      const parsed = typeof value === 'string' && num(value) === null ? value : num(value);
      return {
        id: String(first(m, 'id', 'metric_id', 'indicador_id') ?? `metric_${i}`),
        label: String(first(m, 'label', 'etiqueta', 'nombre') ?? 'Indicador'),
        value: parsed ?? null,
        unit: str(first(m, 'unit', 'unidad')),
        definition: str(first(m, 'definition', 'definicion', 'definición')),
        source: str(first(m, 'source', 'fuente')),
        status: metricStatus(m, parsed),
      };
    }),
    sources: toList(sources),
    assumptions: toList(assumptions),
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
