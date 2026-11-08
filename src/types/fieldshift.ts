export type AlternativeType = 'economy' | 'water' | 'soil';
export type ComparisonStatus = 'ready' | 'processing' | 'failed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type DataQualityLevel = 'sufficient' | 'limited' | 'insufficient' | 'unknown';

export interface Campaign {
  crop: string;
  window: string;
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
  campaigns: Campaign[];
  margin: { min: number; max: number; currency: string; basis: string };
  water: { metric: string; value: number; unit: string };
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
