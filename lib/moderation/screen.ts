/**
 * screen.ts
 *
 * Two-stage moderation utilities for user-submitted narrative text.
 *
 * Stage A – `screenUserText`  : async, calls OpenAI Moderation API.
 * Stage B – `screenPullQuote` : sync,  regex blocklist for PII / slurs.
 *
 * Stage A runs before LLM analysis (cheap, fast).
 * Stage B runs after LLM analysis on the generated pull_quote before the
 * story is persisted (catches LLM hallucinations that embed harmful content).
 */

import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// OpenAI client (singleton – re-used across Lambda warm invocations)
// ---------------------------------------------------------------------------

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// ---------------------------------------------------------------------------
// Stage A – OpenAI Moderation API
// ---------------------------------------------------------------------------

export interface ModerationResult {
  /** True when OpenAI flags the text as policy-violating. */
  flagged: boolean;
  /** Human-readable names of every triggered category. */
  categories: string[];
}

/**
 * Runs the user's raw narrative through OpenAI's omni-moderation model.
 *
 * Returns `{ flagged: true, categories: [...] }` if any category is triggered,
 * or `{ flagged: false, categories: [] }` when the text is clean.
 *
 * Throws on network / API errors – the caller (route handler) should catch and
 * return a 500.
 */
export async function screenUserText(text: string): Promise<ModerationResult> {
  const response = await openai.moderations.create({
    model: 'omni-moderation-latest',
    input: text,
  });

  const result = response.results[0];
  if (!result) {
    // Defensive: treat missing result as safe rather than crashing
    return { flagged: false, categories: [] };
  }

  if (!result.flagged) {
    return { flagged: false, categories: [] };
  }

  // Collect the names of every category that scored true
  const triggeredCategories = Object.entries(result.categories)
    .filter(([, triggered]) => triggered === true)
    .map(([name]) => name);

  return { flagged: true, categories: triggeredCategories };
}

// ---------------------------------------------------------------------------
// Stage B – Synchronous regex blocklist
// ---------------------------------------------------------------------------

/**
 * PII and slur patterns to block from persisted pull quotes.
 *
 * All patterns use \b word-boundaries or anchored structure to reduce false
 * positives.  The slur patterns use abbreviations/stems to keep the source
 * tasteful; extend carefully.
 */
const BLOCKLIST_PATTERNS: RegExp[] = [
  // ── PII ──────────────────────────────────────────────────────────────────

  // US Social Security Numbers  (e.g. 123-45-6789)
  /\b\d{3}-\d{2}-\d{4}\b/,

  // US phone numbers in common formats (10–11 digits with separators)
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/,

  // Email addresses (simplified RFC-ish pattern)
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/,

  // Credit card numbers (4 groups of 4 digits with optional separators)
  /\b(?:\d{4}[-\s]?){3}\d{4}\b/,

  // ── Hate slurs (abbreviated stems with word boundaries) ──────────────────
  // These patterns are intentionally abbreviated to keep the source code
  // appropriate. Extend this list via an external blocklist file in production.

  // Racial slur – n-word stem (covers common variations)
  /\bn[i1!][g9][g9][ae3][r]/i,

  // Anti-semitic slur – k-word
  /\bk[i!1]k[e3]\b/i,

  // Homophobic slur – f-word (distinct from the common profanity)
  /\bf[a@][g9][g9]?[o0]?[t+]?\b/i,

  // Ethnic slur targeting South Asian communities
  /\bw[o0][g9]\b/i,

  // Slur targeting people with disabilities (r-word)
  /\br[e3]t[a@]rd/i,
];

/**
 * Synchronously checks whether `text` contains PII or hate speech that would
 * require manual review before the story is published.
 *
 * @returns `true`  → escalate to PENDING moderation status.
 * @returns `false` → text is clean, may proceed to APPROVED.
 */
export function screenPullQuote(text: string): boolean {
  return BLOCKLIST_PATTERNS.some((pattern) => pattern.test(text));
}
