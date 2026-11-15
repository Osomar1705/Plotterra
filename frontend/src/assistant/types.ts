import type { AppliedChange, AlternativeType, Comparison, EntryConditions } from '../types/fieldshift';

export type GuidePage = 'parcel' | 'comparison' | 'plan';
export type GuideStatus = 'answered' | 'needs_clarification' | 'proposed_change' | 'unsupported';

export interface GuideContext {
  page: GuidePage;
  parcel?: EntryConditions & { locality?: string };
  comparison?: Comparison;
  selectedAlternativeId?: string;
  campaignIndex?: number;
  engine?: 'local_mock' | 'backend';
  displayFx?: { penPerUsd: number; asOf: string };
}

export interface GuideMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface GuideReply {
  status: GuideStatus;
  message: string;
  intent?: string;
  conversationId?: string;
  suggestions?: string[];
  sources?: string[];
  change?: AppliedChange;
  requiresConfirmation?: boolean;
  runId?: string;
}

export interface GuideClarification {
  kind: 'irrigation_percent';
  originalQuestion: string;
}

export interface GuideRequest {
  message: string;
  conversationId: string;
  context: GuideContext;
  history: GuideMessage[];
  pendingClarification?: GuideClarification | null;
}

export const GUIDE_ALTERNATIVE_NAMES: Record<AlternativeType, string> = {
  economy: 'Earn more money',
  water: 'Save water',
  soil: 'Care for my soil',
};
