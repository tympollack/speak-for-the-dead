/**
 * app/api/analyze/route.ts
 *
 * POST /api/analyze
 *
 * Accepts a user narrative, runs Stage A content moderation, calls the Truth
 * Engine LLM, and returns structured analysis JSON.
 *
 * This endpoint is intentionally stateless — it does NOT persist anything to
 * the database.  Persistence happens in POST /api/submit after the user
 * reviews and confirms the analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { screenUserText } from '@/lib/moderation/screen';
import { analyzeStory } from '@/lib/llm/analyze';

// ---------------------------------------------------------------------------
// Request body schema
// ---------------------------------------------------------------------------

const AnalyzeRequestSchema = z.object({
  /** The user's story in their own words.  Min 50 chars to ensure substance. */
  narrative: z
    .string()
    .min(50, 'Story must be at least 50 characters long.')
    .max(10_000, 'Story must be 10,000 characters or fewer.'),

  /** Whether this is an In Memoriam (fallen) or Near Miss (spared) story. */
  story_type: z.enum(['IN_MEMORIAM', 'NEAR_MISS'], {
    error: 'story_type must be "IN_MEMORIAM" or "NEAR_MISS".',
  }),

  /**
   * Optional answers to follow-up questions from a prior analysis pass.
   * Keys are the original question strings; values are the user's answers.
   */
  follow_up_answers: z.record(z.string(), z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Parse & validate request body ─────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  let input: z.infer<typeof AnalyzeRequestSchema>;
  try {
    input = AnalyzeRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Request validation failed.',
          details: err.flatten().fieldErrors,
        },
        { status: 422 },
      );
    }
    throw err;
  }

  const { narrative, story_type, follow_up_answers } = input;

  // ── 2. Stage A moderation — screen the raw narrative ─────────────────────
  try {
    const moderation = await screenUserText(narrative);

    if (moderation.flagged) {
      return NextResponse.json(
        {
          error: 'content_flagged',
          message:
            "We weren't able to process this story. If you believe this is an error, please contact support.",
        },
        { status: 422 },
      );
    }
  } catch (err) {
    console.error('[/api/analyze] Stage A moderation error:', err);
    return NextResponse.json(
      {
        error: 'moderation_unavailable',
        message: 'Content moderation is temporarily unavailable. Please try again shortly.',
      },
      { status: 503 },
    );
  }

  // ── 3. Screen follow-up answers if provided ───────────────────────────────
  if (follow_up_answers && Object.keys(follow_up_answers).length > 0) {
    const combinedAnswers = Object.values(follow_up_answers).join(' ');
    try {
      const answerModeration = await screenUserText(combinedAnswers);
      if (answerModeration.flagged) {
        return NextResponse.json(
          {
            error: 'content_flagged',
            message:
              "We weren't able to process this story. If you believe this is an error, please contact support.",
          },
          { status: 422 },
        );
      }
    } catch (err) {
      console.error('[/api/analyze] Follow-up answer moderation error:', err);
      // Non-fatal: proceed without screening follow_up_answers rather than
      // blocking the user entirely.
    }
  }

  // ── 4. LLM analysis ───────────────────────────────────────────────────────
  try {
    const analysis = await analyzeStory({ narrative, story_type, follow_up_answers });

    return NextResponse.json(analysis, { status: 200 });
  } catch (err) {
    console.error('[/api/analyze] LLM analysis error or validation failure, triggering fallback:', err);
    return NextResponse.json(
      { isFallback: true },
      { status: 200 },
    );
  }
}
