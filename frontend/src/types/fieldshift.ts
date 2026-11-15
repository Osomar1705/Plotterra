export type AlternativeType = 'economy' | 'water' | 'soil';
export type AlternativeKind = AlternativeType | 'unknown';
export type ComparisonStatus = 'ready' | 'processing' | 'failed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type DataQualityLevel = 'sufficient' | 'limited' | 'insufficient' | 'unknown';

export interface MetricValue {
  value: number | string | null;
  unit?: string;
  label?: string;
  status?: 'available' | 'provisional' | 'mock' | 'unavailable' | string;
}

export interface Campaign {
  id?: string;
  crop: string;
  cropId?: string;
  window: string;
  startMonth?: string;   // "2026-10"
  endMonth?: string;     // "2027-03"
  /** Suggested sowing day and modelled harvest day from the agricultural engine. */
  sowingDate?: string;   // "2026-10-15" (ISO)
  harvestDate?: string;  // "2027-05-03" (ISO)
  durationDays?: number;
  /** Dates from the real engine or illustrative local demonstration data. */
  calendarSource?: 'engine' | 'demo';
  metrics?: { yield?: MetricValue; water?: MetricValue; economy?: MetricValue; soil?: MetricValue };
}

// --- 100 futuros -----------------------------------------------------------
export type ScenarioFamily = 'tipica' | 'menos_lluvia' | 'menos_riego' | 'caida_precio' | 'combinado';

export interface ScenarioMeta {
  id: string;
  family: ScenarioFamily;
  climateYears: string[];
  baseId?: string;
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
  type: AlternativeType;
  name?: string;
  campaigns: Campaign[];
  margin: { min: number; max: number; currency: string; basis: string; period?: string };
  water: { metric: string; value: number; unit: string; period?: string };
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
  engineVersion?: string;
  datasetVersion?: string;
  scenarios?: ScenarioMeta[];
  usualPlan?: Alternative;
  rainfallMonthlyMm?: number[];   // 12 valores, de agosto a julio
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


export interface PassportMetric {
  id: string; label: string; value: number | string | null; unit?: string; definition?: string; source?: string; status: string;
}
export interface AlternativePassport {
  alternativeId: string; sourceResult?: string; engineVersion?: string; datasetVersion?: string;
  metrics: PassportMetric[]; sources: string[]; assumptions: string[];
}
