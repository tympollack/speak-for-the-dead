/**
 * analysis.schema.ts
 *
 * Zod schemas for structured LLM output from the Truth Engine.
 *
 * The top-level `StoryAnalysisSchema` is split into two sub-schemas that branch
 * on `incident_outcome`:
 *
 *  • FallenLegalTags  – FATALITY | INJURY | ILLNESS  → requires negligent-party fields
 *  • SparedLegalTags  – SPARED   | NEAR_MISS         → requires protection/regulation fields
 *
 * These are composed into a plain `z.union` (rather than `z.discriminatedUnion`)
 * because `z.discriminatedUnion` requires the discriminant to be a single literal
 * per branch; our branches each cover multiple enum values.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared enum schemas (mirror DB CHECK constraints)
// ---------------------------------------------------------------------------

/** Regulatory bodies recognised by the platform. */
export const AgencyCodeEnum = z.enum([
  'OSHA',
  'EPA',
  'FDA',
  'USDA',
  'CPSC',
  'DOT',
  'SEC',
  'OTHER',
]);

/** Who is held responsible for the incident. */
export const TargetOfBlameEnum = z.enum([
  'CORPORATION',
  'GOVERNMENT_AGENCY',
  'BOTH',
  'UNKNOWN',
]);

/** The emotional/political posture of the community submitting the story. */
export const CommunityStanceEnum = z.enum([
  'DEMANDS_CHANGE',
  'SEEKS_JUSTICE',
  'SHARES_GRIEF',
  'CELEBRATES_SURVIVAL',
]);

/** The health/safety outcome described in the story. */
export const IncidentOutcomeEnum = z.enum([
  'FATALITY',
  'INJURY',
  'ILLNESS',
  'NEAR_MISS',
  'SPARED',
]);

// ---------------------------------------------------------------------------
// Branch A – Fallen stories (FATALITY | INJURY | ILLNESS)
// ---------------------------------------------------------------------------

/**
 * Legal tags extracted from a story where someone was harmed.
 * Requires negligent-party identification and violation category.
 */
const FallenLegalTags = z.object({
  /** Discriminant – one of the three "harm occurred" outcomes. */
  incident_outcome: z.enum(['FATALITY', 'INJURY', 'ILLNESS']),

  /** Regulatory body whose rules were violated or failed to be enforced. */
  agency_code: AgencyCodeEnum,

  /**
   * Name of the company or government agency whose negligence caused the harm.
   * Must be non-empty; the LLM should derive this from the narrative.
   */
  negligent_party_name: z
    .string()
    .min(1)
    .describe('Name of the company or agency responsible'),

  /**
   * The specific type of violation or form of negligence (e.g. "Failure to
   * install required machine guards", "Unpermitted toxic discharge").
   */
  violation_category: z
    .string()
    .min(1)
    .describe('The specific type of violation or negligence'),

  /**
   * Specific company name when the negligent party is a known brand name
   * different from the legal entity name (optional).
   */
  company_name: z
    .string()
    .optional()
    .describe('Specific company name if different from negligent party'),

  /**
   * A compassionate 2-sentence summary of the human impact of this story.
   * Must fit within a social-share character limit.
   */
  pull_quote: z
    .string()
    .max(280)
    .describe(
      'A compassionate 2-sentence summary of the human impact of this story',
    ),
});

// ---------------------------------------------------------------------------
// Branch B – Spared stories (SPARED | NEAR_MISS)
// ---------------------------------------------------------------------------

/**
 * Legal tags extracted from a story where regulation *protected* someone.
 * Requires identification of the specific regulation that prevented harm.
 */
const SparedLegalTags = z.object({
  /** Discriminant – one of the two "harm avoided" outcomes. */
  incident_outcome: z.enum(['SPARED', 'NEAR_MISS']),

  /**
   * The specific regulation, standard, or rule that protected this person
   * (e.g. "OSHA 29 CFR 1910.217 – Machine Guarding").
   */
  regulation_credited: z
    .string()
    .min(1)
    .describe('The specific regulation that protected this person'),

  /**
   * A concrete description of *how* the regulation prevented harm
   * (e.g. "Required interlocking guard halted the press before contact").
   */
  mechanism_of_protection: z
    .string()
    .min(1)
    .describe('How the regulation specifically prevented harm'),

  /** Regulatory body that authored or enforces the credited regulation. */
  agency_code: AgencyCodeEnum,

  /** Company or workplace where the near-miss / survival occurred (optional). */
  company_name: z.string().optional(),

  /**
   * A compassionate 2-sentence summary of how a regulation saved or protected
   * this person. Must fit within a social-share character limit.
   */
  pull_quote: z
    .string()
    .max(280)
    .describe(
      'A compassionate 2-sentence summary of how a regulation saved or protected this person',
    ),
});

// ---------------------------------------------------------------------------
// Truth Engine metrics (shared across both branches)
// ---------------------------------------------------------------------------

/**
 * Quantitative and categorical signals produced by the Truth Engine.
 * These power the globe visualisation and editorial moderation queue.
 */
const TruthEngineMetricsSchema = z.object({
  /** Who the story ultimately holds responsible for the incident. */
  target_of_blame: TargetOfBlameEnum,

  /**
   * How preventable was this incident on a scale of 1 (freak accident) to
   * 10 (entirely preventable with existing regulation)?
   */
  preventability_score: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe(
      'How preventable was this incident on a scale of 1-10',
    ),

  /** The emotional/political posture inferred from the narrative. */
  community_stance: CommunityStanceEnum,

  /**
   * 0–2 empathetic follow-up questions to ask the submitter when critical
   * regulatory details (agency, company, specific violation) are genuinely
   * missing. Should be an empty array when the story is already complete.
   */
  follow_up_questions: z
    .array(z.string().max(200))
    .max(2)
    .describe(
      '0-2 empathetic follow-up questions if key regulatory details are missing. Empty array if story is complete.',
    ),
});

// ---------------------------------------------------------------------------
// Top-level schema
// ---------------------------------------------------------------------------

/**
 * The complete structured output expected from the LLM analysis pass.
 *
 * `legal_tags` branches on `incident_outcome` (see FallenLegalTags /
 * SparedLegalTags above).  `truth_metrics` are always present.
 */
export const StoryAnalysisSchema = z.object({
  /** Outcome-specific legal tags – shape depends on `incident_outcome`. */
  legal_tags: z.union([FallenLegalTags, SparedLegalTags]),

  /** Truth Engine signals for moderation, sorting, and visualisation. */
  truth_metrics: TruthEngineMetricsSchema,
});

// ---------------------------------------------------------------------------
// Derived TypeScript types (inferred from schemas – single source of truth)
// ---------------------------------------------------------------------------

export type StoryAnalysis = z.infer<typeof StoryAnalysisSchema>;
export type LegalTags = z.infer<typeof StoryAnalysisSchema>['legal_tags'];
export type TruthEngineMetrics = z.infer<typeof TruthEngineMetricsSchema>;
export type FallenLegalTagsType = z.infer<typeof FallenLegalTags>;
export type SparedLegalTagsType = z.infer<typeof SparedLegalTags>;
