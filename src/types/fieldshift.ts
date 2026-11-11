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
  window: string;
  /** Desglose por campana. Ausente si el backend solo devuelve agregados de la ruta. */
  metrics?: CampaignMetrics;
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
}

export interface FieldShiftApiError {
  code: string;
  field?: string | null;
  technicalMessage?: string;
  farmerMessage: string;
  suggestedAction?: string;
  runId?: string;
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
