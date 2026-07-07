/**
 * analyze.ts
 *
 * LLM wrapper for the Truth Engine – single-pass structured analysis of a
 * user-submitted story.
 *
 * Uses `openai.beta.chat.completions.parse` with `zodResponseFormat` to
 * guarantee that the model's output strictly conforms to `StoryAnalysisSchema`.
 * Any response that fails Zod validation causes a descriptive error to be thrown.
 */

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  StoryAnalysisSchema,
  type StoryAnalysis,
} from '@/lib/schemas/analysis.schema';

// ---------------------------------------------------------------------------
// OpenAI client (singleton)
// ---------------------------------------------------------------------------

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key' });

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface AnalyzeInput {
  /** The survivor / family member's story in their own words. */
  narrative: string;
  /** Submission type — affects which legal-tag branch the LLM should target. */
  story_type: 'IN_MEMORIAM' | 'NEAR_MISS';
  /**
   * Optional answers to follow-up questions from a previous analysis pass.
   * Keys are the original follow-up question strings; values are the answers.
   */
  follow_up_answers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

/**
 * Builds a compassionate, directive system prompt that instructs the LLM on
 * exactly how to populate `StoryAnalysisSchema`.
 *
 * Keeping this as a function (rather than a module-level constant) makes it
 * easy to unit-test and to vary tone/detail based on `story_type`.
 */
function buildSystemPrompt(story_type: AnalyzeInput['story_type']): string {
  const outcomeGuidance =
    story_type === 'NEAR_MISS'
      ? `The submitter survived or narrowly avoided harm.  Set \`incident_outcome\` to
"SPARED" or "NEAR_MISS" (prefer "NEAR_MISS" unless the person explicitly says
they were completely unharmed).  Always populate \`regulation_credited\` and
\`mechanism_of_protection\` — these are the heart of a Spared story.`
      : `The submitter is memorialising someone who was killed, injured, or made ill.
Set \`incident_outcome\` to "FATALITY", "INJURY", or "ILLNESS" as appropriate.
Always populate \`negligent_party_name\` and \`violation_category\` — these are
the heart of an In Memoriam story.`;

  return `You are a compassionate legal-advocacy analyst working for "Speak for the Dead",
a platform that amplifies the voices of survivors and bereaved families in
regulatory-negligence cases.

Your role is to read a first-person story submitted by a survivor or family
member, extract structured legal and emotional metadata in a single pass, and
return it as valid JSON that exactly matches the schema you have been given.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STORY TYPE: ${story_type}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${outcomeGuidance}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD-BY-FIELD INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

legal_tags.agency_code
  Choose the single most relevant US regulatory agency.  Map workplace injuries
  → OSHA, environmental harm → EPA, food/drug → FDA, vehicle → DOT, product
  safety → CPSC, financial fraud → SEC.  Use OTHER only as a last resort.

legal_tags.pull_quote
  Write EXACTLY 2 sentences.  The tone must be:
    • Dignified and grief-aware — never sensationalist.
    • In the third person ("She spent 14 years fighting for compensation…").
    • Focused on the *human impact*, not legal jargon.
  Hard limit: 280 characters total (including spaces and punctuation).

truth_metrics.preventability_score
  1  = unforeseeable freak accident; existing regulation could not have helped.
  10 = the exact regulation existed, the company knew, and chose not to comply.
  Use the full scale; avoid clustering answers around 5.

truth_metrics.follow_up_questions
  Populate with 0–2 short, empathetic questions ONLY when a field you need is
  genuinely absent from the narrative — for example, you cannot identify the
  company name or the specific regulation violated.
  DO NOT ask clarifying questions if the narrative already contains the answer.
  Format each question so it could be read aloud to a grieving family member.
  Leave as an empty array [] when the story is complete.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERAL PRINCIPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Treat every submitter with the dignity of a witness in a courtroom.
• Never invent facts; if a required field cannot be inferred from the narrative,
  use your best professional judgement AND add a follow-up question.
• Regulatory precision matters: prefer citing the specific CFR section or named
  standard over vague descriptions (e.g. "OSHA 29 CFR 1910.303(b)(1)" not just
  "electrical safety rules").
• Output ONLY the JSON object — no preamble, no explanation.`;
}

// ---------------------------------------------------------------------------
// Core analysis function
// ---------------------------------------------------------------------------

/**
 * Runs a single-pass structured analysis of a user story using GPT-4o with
 * structured outputs.
 *
 * @throws {Error} when the API call fails or the response fails schema validation.
 */
export async function analyzeStory(input: AnalyzeInput): Promise<StoryAnalysis> {
  const { narrative, story_type, follow_up_answers } = input;

  // Build the user message — append follow-up answers if provided so the
  // model treats them as supplementary context for the same story.
  let userContent = `STORY:\n${narrative}`;

  if (follow_up_answers && Object.keys(follow_up_answers).length > 0) {
    const answersBlock = Object.entries(follow_up_answers)
      .map(([question, answer]) => `Q: ${question}\nA: ${answer}`)
      .join('\n\n');
    userContent += `\n\nSUPPLEMENTARY INFORMATION (answers to follow-up questions):\n${answersBlock}`;
  }

  // Call the structured-output endpoint. `zodResponseFormat` generates a JSON
  // Schema from our Zod schema and constrains the model to produce conforming JSON.
  // NOTE: In OpenAI SDK v6 this moved from openai.beta.chat → openai.chat.
  const completion = await openai.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    temperature: 0.2, // Low temperature for consistent, factual extraction
    messages: [
      { role: 'system', content: buildSystemPrompt(story_type) },
      { role: 'user', content: userContent },
    ],
    response_format: zodResponseFormat(StoryAnalysisSchema, 'story_analysis'),
  });

  const message = completion.choices[0]?.message;

  // `parsed` is populated by the SDK when the model returns valid JSON that
  // matches the schema.  If parsing failed, `refusal` will be set instead.
  if (message?.refusal) {
    throw new Error(
      `LLM refused to analyse this story: ${message.refusal}`,
    );
  }

  if (!message?.parsed) {
    throw new Error(
      'LLM returned an empty or unparseable response.  Please try again.',
    );
  }

  // Run the Zod schema again as a defence-in-depth check (the SDK may parse
  // partial objects in edge cases).
  const validated = StoryAnalysisSchema.parse(message.parsed);

  return validated;
}
