export type AlternativeType = 'economy' | 'water' | 'soil';
/** El motor puede devolver una alternativa cuyo criterio no logra identificar. */
export type AlternativeKind = AlternativeType | 'unknown';
export type ComparisonStatus = 'ready' | 'processing' | 'failed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type DataQualityLevel = 'sufficient' | 'limited' | 'insufficient' | 'unknown';

/** Estado de un indicador: la vista distingue dato real, provisional, demo y ausente. */
export type MetricStatus = 'available' | 'provisional' | 'mock' | 'unavailable';

/**
 * Indicador suelto. `value` es null cuando el motor no lo devolvio: la vista
 * muestra "No disponible" en lugar de rellenar con un cero enganoso.
 */
export interface MetricValue {
  label?: string;
  value: number | string | null;
  unit?: string;
  status: MetricStatus;
  period?: string;
}

export interface CampaignMetrics {
  yield?: MetricValue;
  water?: MetricValue;
  economy?: MetricValue;
  soil?: MetricValue;
}

export interface Campaign {
  id?: string;
  crop: string;
  cropId?: string;
  window: string;
  /** Desglose por campana. Ausente si el backend solo devuelve agregados de la ruta. */
  metrics?: CampaignMetrics;
  startMonth?: string;   // "2026-10"
  endMonth?: string;     // "2027-03"
}

// --- 100 futuros -----------------------------------------------------------
export type ScenarioFamily = 'tipica' | 'menos_lluvia' | 'menos_riego' | 'caida_precio' | 'combinado';

export interface ScenarioMeta {
  id: string;
  family: ScenarioFamily;
  climateYears: string[];
  baseId?: string;
  /** Factores del escenario (1 = sin cambio). El motor real los sortea por futuro. */
  rainFactor?: number;
  irrigationFactor?: number;
  priceFactor?: number;
}

export interface Outcomes {
  /** Margen del horizonte (S/ por ha, 3 campañas) en cada escenario, en el orden de Comparison.scenarios. */
  marginByScenario: number[];
  wins?: number;
  losses?: number;
  mean?: number;
  adverse?: number;
}

export interface StressRow {
  family: ScenarioFamily | string;
  label: string;
  meanMargin: number;
  changeVsTypical: number;
}

export interface AppliedChange {
  id?: string;
  type: string;
  operation?: string;
  value?: number | string;
  unit?: string;
  label?: string;
}

export interface Alternative {
  id: string;
  /** Nombre propio devuelto por el motor; si falta, la vista usa el de routeMeta. */
  name?: string;
  type: AlternativeKind;
  campaigns: Campaign[];
  margin: { min: number | null; max: number | null; currency: string; basis: string; period?: string };
  water: { metric: string; value: number | null; unit: string; period?: string };
  soil: { compatibility: string };
  risk: { level: RiskLevel; mainCause?: string | null };
  dataQuality: { level: DataQualityLevel; mainGap?: string | null };
  sequence?: string;
  outcomes?: Outcomes;
  stressTest?: StressRow[];
  explanation?: { why?: string; dataThatWouldChange?: string };
  tradeoffs?: { advantages: string[]; risks: string[]; costOfPriority?: string };
}

export interface Comparison {
  id: string;
  plotId: string;
  areaHa?: number;
  priority: AlternativeType;
  status: ComparisonStatus;
  activeChanges: AppliedChange[];
  alternatives: Alternative[];
  sourceResult?: 'mock' | 'calculado' | 'cache' | string;
  parentComparisonId?: string;
  runId?: string;
  /** Trazabilidad: version del motor de calculo y del dataset usados. */
  engineVersion?: string;
  datasetVersion?: string;
  /** Los 100 futuros simulados; cada Alternative.outcomes sigue este orden. */
  scenarios?: ScenarioMeta[];
  usualPlan?: Alternative;
  rainfallMonthlyMm?: number[];   // 12 valores, de agosto a julio
}

/** Un indicador del pasaporte, con su definicion y fuente para auditarlo. */
export interface PassportMetric {
  id: string;
  label: string;
  value: number | string | null;
  unit?: string;
  definition?: string;
  source?: string;
  status: MetricStatus;
}

/**
 * Pasaporte de trazabilidad de una alternativa: de donde sale cada numero.
 * `sources` y `assumptions` son siempre arrays para que la vista pueda
 * consultar .length sin comprobar null.
 */
export interface AlternativePassport {
  alternativeId: string;
  comparisonId?: string;
  sourceResult?: string;
  engineVersion?: string;
  datasetVersion?: string;
  metrics: PassportMetric[];
  sources: string[];
  assumptions: string[];
  /** Explicacion en lenguaje del agricultor: por que conviene, que se sacrifica, que dato la cambiaria. */
  explanation?: { why?: string; tradeoff?: string; dataThatWouldChange?: string };
}

export interface FieldShiftApiError {
  code: string;
  field?: string | null;
  technicalMessage?: string;
  farmerMessage: string;
  suggestedAction?: string;
  runId?: string;
  engineVersion?: string;
  datasetVersion?: string;
}

export interface AssistantInterpretation {
  status: 'understood' | 'needs_clarification' | 'unsupported';
  intent?: string;
  change?: AppliedChange;
  needsConfirmation?: boolean;
  clarification?: string;
}

export interface EntryConditions {
  plotId?: string;
  areaHa?: number;
  startDate?: string;
  previousCrop?: string;
  waterMode?: string;
  irrigationMm?: number;
  allowedCrops?: string[];
  priority?: AlternativeType;
  horizon?: number;
  seed?: number;
  [key: string]: unknown;
}

// --- Vista 01: entrada de la parcela ---

export type WaterMode = 'rainfed' | 'scheduled' | 'irrigated';

export type ExclusionReason = 'sin_comprador' | 'no_en_mi_zona' | 'no_quiero';

/** Vertice de la parcela en grados: x = longitud, y = latitud (orden GeoJSON). */
export interface PlotPoint { x: number; y: number }

export interface ExcludedCrop {
  crop: string;
  reason: ExclusionReason;
}

export interface PlotSuggestions {
  rainfallMm?: number;
  rainfallSource?: string;
  soilTexture?: string;
  fieldCapacityMm?: number;
  soilSource?: string;
  soilUncertainty?: string;
}

/** Respuesta de POST /parcelas: el backend valida y devuelve area y sugerencias. */
export interface Plot {
  id: string;
  areaHa: number;
  locality?: string;
  cellId?: string;
  suggestions?: PlotSuggestions;
}

export interface PlotDraft {
  points: PlotPoint[];
  declaredAreaHa?: number;
  locality?: string;
}

// --- Verdor de la parcela (GET /parcelas/{id}/verdor) ---

export type GreennessPattern = 'ciclo_de_cultivo' | 'sin_vegetacion' | 'vegetacion_permanente' | 'dudoso';

export interface GreennessPoint { date: string; ndvi: number }

export interface Greenness {
  available: boolean;
  /** Motivo cuando no hay verdor: sin_dibujo, fuera_del_punto_medido, sin_datos. */
  reason?: string;
  farmerMessage: string;
  pattern?: GreennessPattern;
  series: GreennessPoint[];
  monthly: { month: number; ndvi: number }[];
  clearImages?: number;
  scenes?: number;
  lastYear?: { min: number | null; max: number | null; images: number };
  source?: string;
  /** Verdor de las chacras del distrito (HLS): sirve para cualquier parcela de Huanuco. */
  district?: DistrictGreenness;
  /** Estres de la vegetacion (ECOSTRESS ESI) por mes; por ahora solo Ambo. */
  stress?: VegetationStress;
}

export interface DistrictGreenness {
  name: string;
  farmerMessage: string;
  /** false cuando el verdor apenas cambia en el anio (selva): no se nombran meses. */
  distinguishable: boolean;
  monthly: { month: number; ndvi: number }[];
  clearImages?: number;
  source?: string;
  scope?: string;
}

export interface VegetationStress {
  farmerMessage: string;
  reading?: string;
  monthly: { month: number; esi: number | null; fewObservations: boolean }[];
  source?: string;
  scope?: string;
}
