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
      id: first(c, 'id'),
      crop: String(first(c, 'crop', 'cultivo') ?? '—'),
      cropId: first(c, 'crop_id', 'cropId', 'cultivo_id'),
      // In the Python backend `ventana` is an alias for sowing→harvest dates;
      // it is NOT a multi-month planting window. Preserve the actual endpoints.
      window: String(first(c, 'planting_window', 'sowing_window', 'window') ??
        (first(c, 'siembra', 'sowing_date', 'sowingDate') ? String(first(c, 'siembra', 'sowing_date', 'sowingDate')) :
        first(c, 'ventana', 'fecha') ?? '—')),
      sowingDate: first(c, 'siembra', 'sowing_date', 'sowingDate'),
      harvestDate: first(c, 'cosecha', 'harvest_date', 'harvestDate'),
      durationDays: (() => {
        const days = first(c, 'duracion_dias', 'duration_days', 'durationDays', 'ventana_dias');
        return typeof days === 'number' && Number.isFinite(days) ? days : undefined;
      })(),
      calendarSource: first(c, 'siembra', 'sowing_date', 'sowingDate') && first(c, 'cosecha', 'harvest_date', 'harvestDate') ? 'engine' : undefined,
      startMonth: first(c, 'start_month', 'startMonth') ?? (String(first(c, 'siembra', 'sowing_date', 'sowingDate') ?? '').slice(0,7) || undefined),
      endMonth: first(c, 'end_month', 'endMonth') ?? (String(first(c, 'cosecha', 'harvest_date', 'harvestDate') ?? '').slice(0,7) || undefined),
      metrics: first(c, 'metrics', 'metricas') ?? undefined,
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
    sequence: first(raw, 'sequence', 'secuencia'),
    outcomes: normalizeOutcomes(raw, margin),
    stressTest: normalizeStress(first(raw?.detalle, 'stress_test') ?? first(raw, 'stress_test', 'stressTest')),
    explanation: normalizeExplanation(first(raw?.detalle, 'explicacion') ?? first(raw, 'explanation')),
    tradeoffs: normalizeTradeoffs(first(raw?.detalle, 'tradeoffs') ?? first(raw, 'tradeoffs')),
  };
}

/** outcomes del backend, o reconstruido desde detalle.distribucion_margen_S_ha. Nunca inventa valores. */
function normalizeOutcomes(raw: any, margin: any) {
  const o = first(raw, 'outcomes');
  const dist = first(o, 'margin_by_scenario', 'marginByScenario') ?? first(raw?.detalle, 'distribucion_margen_S_ha');
  if (!Array.isArray(dist) || dist.length === 0) return undefined;
  return {
    marginByScenario: dist.map(Number),
    wins: first(o, 'wins'), losses: first(o, 'losses'),
    mean: first(o, 'mean') ?? first(margin, 'mean'),
    adverse: first(o, 'adverse') ?? first(margin, 'adverse'),
  };
}

function normalizeStress(rows: any) {
  if (!Array.isArray(rows)) return undefined;
  return rows.map((r: any) => ({
    family: String(first(r, 'familia', 'family') ?? ''),
    label: String(first(r, 'nombre', 'label') ?? ''),
    meanMargin: Number(first(r, 'margen_medio_S_ha_horizonte', 'meanMargin') ?? 0),
    changeVsTypical: Number(first(r, 'cambio_vs_tipica_S_ha', 'changeVsTypical') ?? 0),
  }));
}

function normalizeExplanation(e: any) {
  if (!e) return undefined;
  return { why: first(e, 'por_que', 'why'), dataThatWouldChange: first(e, 'dato_que_cambiaria_la_decision', 'dataThatWouldChange') };
}

function normalizeTradeoffs(t: any) {
  if (!t) return undefined;
  return { advantages: first(t, 'ventajas', 'advantages') ?? [], risks: first(t, 'riesgos', 'risks') ?? [],
           costOfPriority: first(t, 'costo_de_priorizar', 'costOfPriority') };
}

const FAMILIES = ['tipica', 'menos_lluvia', 'menos_riego', 'caida_precio', 'combinado'];
const FAMILY_ALIASES: Record<string,string> = {
  condiciones_tipicas:'tipica', menor_lluvia:'menos_lluvia', caida_de_precio:'caida_precio', combinado_adverso:'combinado',
  typical:'tipica', less_rain:'menos_lluvia', less_irrigation:'menos_riego', lower_prices:'caida_precio', combined:'combinado',
};
/** Optional number: undefined when missing or not a number. */
const factor = (v: unknown): number | undefined => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? undefined : n;
};

function normalizeScenarios(rows: any) {
  if (!Array.isArray(rows)) return undefined;
  return rows.map((r: any, i: number) => ({
    id: String(first(r, 'id', 'escenario_id') ?? `esc_${i}`),
    family: (() => { const f=String(first(r, 'familia', 'family')??''); return (FAMILIES.includes(f)?f:FAMILY_ALIASES[f]??'tipica') as import('../types/fieldshift').ScenarioFamily; })(),
    climateYears: first(r, 'anios_clima', 'climateYears') ?? [],
    baseId: first(r, 'futuro_base', 'baseId'),
    rainFactor: factor(first(r, 'factor_lluvia', 'rainFactor')),
    irrigationFactor: factor(first(r, 'factor_riego', 'irrigationFactor')),
    priceFactor: factor(first(r, 'factor_precio', 'priceFactor')),
  }));
}

/**
 * In how many tests each option earns more than the others.
 *
 * "Tests with gain" (margin > 0) reaches 100/100 for almost every profitable
 * rotation and does not help to choose. Comparing the same test across options
 * does: the counts add up to 100. A tie counts for every tied option.
 */
function markBestOf(alternatives: Alternative[]) {
  const withOutcomes = alternatives.filter((a) => a.outcomes?.marginByScenario?.length);
  if (withOutcomes.length < 2) return;
  const n = withOutcomes[0].outcomes!.marginByScenario.length;
  if (withOutcomes.some((a) => a.outcomes!.marginByScenario.length !== n)) return;
  const best = new Map(withOutcomes.map((a) => [a, 0]));
  const ranks = new Map(withOutcomes.map((a) => [a, [] as number[]]));
  for (let j = 0; j < n; j++) {
    const values = withOutcomes.map((a) => a.outcomes!.marginByScenario[j]);
    const top = Math.max(...values);
    for (const a of withOutcomes) {
      const v = a.outcomes!.marginByScenario[j];
      if (v === top) best.set(a, best.get(a)! + 1);
      ranks.get(a)!.push(values.filter((x) => x > v).length);
    }
  }
  for (const a of withOutcomes) { a.outcomes!.best = best.get(a); a.outcomes!.rankByScenario = ranks.get(a); }
}

export function normalizeComparison(raw: any): Comparison {
  const payload = first(raw, 'comparison', 'comparacion', 'resultado') ?? raw;
  const alternatives = first(payload, 'alternatives', 'alternativas') ?? [];
  const activeChanges = first(payload, 'active_changes', 'cambios_activos', 'escenarios_aplicados', 'cambios') ?? [];
  return {
    id: String(first(payload, 'comparison_id', 'id', 'scenario_id', 'comparacion_id') ?? 'unknown'),
    plotId: String(first(payload, 'plot_id', 'parcel_id', 'parcela_id') ?? 'unknown'),
    areaHa: Number(first(payload, 'area_ha', 'areaHa') ?? 0) || undefined,
    priority: altType(first(payload, 'priority', 'prioridad')),
    status: String(first(payload, 'status', 'estado') ?? 'ready').toLowerCase() as Comparison['status'],
    activeChanges: activeChanges.map((c: any) => ({
      id: first(c, 'change_id', 'id', 'cambio_id'),
      type: String(first(c, 'type', 'tipo', 'intent') ?? 'unknown'),
      operation: first(c, 'operation', 'operacion'),
      value: first(c, 'value', 'valor'),
      unit: first(c, 'unit', 'unidad'),
      label: first(c, 'label', 'etiqueta'),
    })),
    alternatives: (() => { const list = alternatives.map(normalizeAlternative); markBestOf(list); return list; })(),
    sourceResult: first(payload, 'fuente_resultado', 'source_result', 'sourceResult'),
    parentComparisonId: first(payload, 'parent_comparison_id', 'comparacion_padre_id', 'derivada_de'),
    scenarios: normalizeScenarios(first(payload, 'scenarios') ?? payload?.simulacion?.escenarios),
    // The backend sends plan_habitual as a summary {evaluado, margen...}, not as an
    // alternative: only normalize it when it brings its own seasons.
    usualPlan: (() => { const u = first(payload, 'usual_plan', 'plan_habitual'); return u && (u.campaigns || u.campanas || u.secuencia) ? normalizeAlternative(u) : undefined; })(),
    rainfallMonthlyMm: first(payload, 'rainfall_monthly_mm', 'rainfallMonthlyMm'),
    engineVersion: first(payload, 'engine_version', 'motor_version'),
    datasetVersion: first(payload, 'dataset_version'),
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
