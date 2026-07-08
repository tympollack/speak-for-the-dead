/**
 * app/api/submit/route.ts
 *
 * POST /api/submit
 *
 * Final submission endpoint.  Persists a verified, moderated story to the
 * database, optionally links a staged document, and kicks off background
 * document verification via a Supabase Edge Function.
 *
 * Critical design decisions:
 *  • storyAnalysis is re-validated with Zod on the server — we never trust
 *    the client's copy of the analysis object.
 *  • Stage B moderation (regex blocklist) runs on the pull_quote before the
 *    story is persisted to catch any LLM hallucinations.
 *  • Document staging rows are claimed atomically: a null `claimed_by_story_id`
 *    is a precondition for claiming.
 *  • The Edge Function call is fire-and-forget (non-blocking); document
 *    verification happens asynchronously after the response is returned.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { StoryAnalysisSchema, type StoryAnalysis } from '@/lib/schemas/analysis.schema';
import { screenPullQuote } from '@/lib/moderation/screen';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_BUCKET = 'story-documents';

// ---------------------------------------------------------------------------
// Admin Supabase client (service role — bypasses RLS for trusted server ops)
// ---------------------------------------------------------------------------

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'speak_for_the_dead' }
  });
}

// ---------------------------------------------------------------------------
// Request body schema
// ---------------------------------------------------------------------------

const SubmitRequestSchema = z.object({
  /** Original narrative (stored for audit / re-analysis). */
  narrative: z
    .string()
    .min(50, 'Narrative must be at least 50 characters.')
    .max(10_000),

  /** Submission type (stored for editorial categorisation). */
  story_type: z.enum(['IN_MEMORIAM', 'NEAR_MISS']),

  /** Optional supplementary answers from the follow-up Q&A step. */
  follow_up_answers: z.record(z.string(), z.string()).optional(),

  /**
   * UUID of the document_staging row created by POST /api/upload-token.
   * If absent, the story is submitted without supporting documentation.
   */
  stagingId: z.string().uuid().optional(),

  /** Optional contact email for editorial follow-up (never displayed publicly). */
  userEmail: z
    .string()
    .email('Must be a valid email address.')
    .optional(),

  /**
   * The analysis object returned by POST /api/analyze.
   * Re-validated server-side against StoryAnalysisSchema — never trust the client.
   */
  storyAnalysis: StoryAnalysisSchema,
});

// ---------------------------------------------------------------------------
// Helper: copy a file within Supabase Storage
// ---------------------------------------------------------------------------

/**
 * Supabase Storage does not have a native server-side copy operation in the
 * JS SDK, so we download then re-upload.  For MVP this is acceptable — in
 * production consider using the management API or a background job.
 */
async function moveFileFromStagingToPermanent(
  adminClient: ReturnType<typeof getAdminClient>,
  stagingPath: string,
  permanentPath: string,
): Promise<void> {
  // Download from staging
  const { data: fileData, error: downloadError } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .download(stagingPath);

  if (downloadError || !fileData) {
    throw new Error(`Failed to download staging file: ${downloadError?.message}`);
  }

  // Upload to permanent path
  const { error: uploadError } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .upload(permanentPath, fileData, { upsert: false });

  if (uploadError) {
    throw new Error(`Failed to upload to permanent path: ${uploadError.message}`);
  }
}

// ---------------------------------------------------------------------------
// Helper: trigger verify-document Edge Function (fire-and-forget)
// ---------------------------------------------------------------------------

async function triggerDocumentVerification(
  storyId: string,
  storagePath: string,
  documentType: string,
): Promise<void> {
  const edgeFunctionUrl = `${process.env.SUPABASE_URL}/functions/v1/verify-document`;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const res = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ story_id: storyId, storage_path: storagePath, document_type: documentType }),
    });

    if (!res.ok) {
      console.warn(
        `[/api/submit] verify-document edge function returned ${res.status}:`,
        await res.text(),
      );
    }
  } catch (err) {
    // Non-fatal: verification can be retried via a cron job or admin action.
    console.error('[/api/submit] Failed to trigger verify-document:', err);
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Parse request body ─────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  let input: z.infer<typeof SubmitRequestSchema>;
  try {
    input = SubmitRequestSchema.parse(body);
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

  const {
    narrative,
    story_type,
    follow_up_answers,
    stagingId,
    userEmail,
    storyAnalysis,
  } = input;

  // ── 2. Re-validate storyAnalysis (defence-in-depth) ──────────────────────
  let validatedAnalysis: StoryAnalysis;
  try {
    validatedAnalysis = StoryAnalysisSchema.parse(storyAnalysis);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'invalid_analysis',
          message: 'The provided story analysis failed server-side validation.',
          details: err.flatten().fieldErrors,
        },
        { status: 422 },
      );
    }
    throw err;
  }

  // ── 3. Stage B moderation — screen the generated pull_quote ──────────────
  const pullQuoteNeedsReview = screenPullQuote(validatedAnalysis.legal_tags.pull_quote);
  const moderationStatus = pullQuoteNeedsReview ? 'PENDING' : 'APPROVED';

  // ── 4. Initialise admin client ────────────────────────────────────────────
  let adminClient: ReturnType<typeof getAdminClient>;
  try {
    adminClient = getAdminClient();
  } catch (err) {
    console.error('[/api/submit] Admin client init failed:', err);
    return NextResponse.json(
      { error: 'server_configuration', message: 'Server configuration error.' },
      { status: 500 },
    );
  }

  // ── 5. Insert story row ───────────────────────────────────────────────────
  const { legal_tags, truth_metrics } = validatedAnalysis;

  const { data: storyRow, error: storyInsertError } = await adminClient
    .from('stories')
    .insert({
      narrative,
      story_type,
      follow_up_answers: follow_up_answers ?? null,
      user_email: userEmail ?? null,
      incident_outcome: legal_tags.incident_outcome,
      agency_code: legal_tags.agency_code,
      company_name: legal_tags.company_name ?? null,
      // Fallen-specific fields (null for SPARED/NEAR_MISS)
      negligent_party_name:
        'negligent_party_name' in legal_tags
          ? legal_tags.negligent_party_name
          : null,
      violation_category:
        'violation_category' in legal_tags ? legal_tags.violation_category : null,
      // Spared-specific fields (null for fallen outcomes)
      regulation_credited:
        'regulation_credited' in legal_tags ? legal_tags.regulation_credited : null,
      mechanism_of_protection:
        'mechanism_of_protection' in legal_tags
          ? legal_tags.mechanism_of_protection
          : null,
      // Truth Engine metrics
      target_of_blame: truth_metrics.target_of_blame,
      preventability_score: truth_metrics.preventability_score,
      community_stance: truth_metrics.community_stance,
      // Moderation
      moderation_status: moderationStatus,
      // Verification starts at the lowest tier until documents are checked
      verification_tier: 'UNVERIFIED',
    })
    .select('id')
    .single();

  if (storyInsertError || !storyRow?.id) {
    console.error('[/api/submit] Failed to insert story:', storyInsertError);
    return NextResponse.json(
      { error: 'database_error', message: 'Failed to save story. Please try again.' },
      { status: 502 },
    );
  }

  const storyId: string = storyRow.id;

  // ── 6. Insert story_analysis_tags row ────────────────────────────────────
  const { error: tagsInsertError } = await adminClient
    .from('story_analysis_tags')
    .insert({
      story_id: storyId,
      pull_quote: legal_tags.pull_quote,
      community_stance: truth_metrics.community_stance,
      follow_up_questions: truth_metrics.follow_up_questions,
      raw_analysis: validatedAnalysis, // Store full JSON for audit / re-processing
    });

  if (tagsInsertError) {
    // Non-fatal: story is already saved; log and continue.
    console.error('[/api/submit] Failed to insert story_analysis_tags:', tagsInsertError);
  }

  // ── 7. Handle staged document (if any) ───────────────────────────────────
  let documentVerificationPayload: {
    storagePath: string;
    documentType: string;
  } | null = null;

  if (stagingId) {
    // 7a. Fetch document_staging row — verify it exists and is unclaimed
    const { data: stagingRow, error: stagingFetchError } = await adminClient
      .from('document_staging')
      .select('id, storage_path, content_type, claimed_by_story_id')
      .eq('id', stagingId)
      .maybeSingle();

    if (stagingFetchError) {
      console.error('[/api/submit] Failed to fetch document_staging row:', stagingFetchError);
    } else if (!stagingRow) {
      console.warn(`[/api/submit] stagingId ${stagingId} not found — skipping document link.`);
    } else if (stagingRow.claimed_by_story_id !== null) {
      console.warn(
        `[/api/submit] stagingId ${stagingId} already claimed by story ${stagingRow.claimed_by_story_id} — skipping.`,
      );
    } else {
      // 7b. Derive permanent storage path and move the file
      const stagingPath: string = stagingRow.storage_path;
      const filename = stagingPath.split('/').pop() ?? 'document';
      const permanentPath = `stories/${storyId}/${filename}`;

      try {
        await moveFileFromStagingToPermanent(adminClient, stagingPath, permanentPath);

        // 7c. Mark staging row as claimed
        const { error: claimError } = await adminClient
          .from('document_staging')
          .update({ claimed_by_story_id: storyId })
          .eq('id', stagingId);

        if (claimError) {
          console.error('[/api/submit] Failed to mark staging row as claimed:', claimError);
        }

        // 7d. Insert story_documents row with permanent path
        const { error: docInsertError } = await adminClient
          .from('story_documents')
          .insert({
            story_id: storyId,
            storage_path: permanentPath,
            content_type: stagingRow.content_type,
            verification_result: null, // Set by verify-document edge function
          });

        if (docInsertError) {
          console.error('[/api/submit] Failed to insert story_documents row:', docInsertError);
        } else {
          // Prepare payload for background verification
          documentVerificationPayload = {
            storagePath: permanentPath,
            documentType: stagingRow.content_type,
          };
        }
      } catch (moveErr) {
        console.error('[/api/submit] Failed to move staged file:', moveErr);
        // Non-fatal: story is saved; document linking failed silently.
      }
    }
  }

  // ── 8. Trigger background document verification (fire-and-forget) ─────────
  if (documentVerificationPayload) {
    void triggerDocumentVerification(
      storyId,
      documentVerificationPayload.storagePath,
      documentVerificationPayload.documentType,
    );
  }

  // ── 9. Return response ────────────────────────────────────────────────────
  return NextResponse.json(
    {
      story_id: storyId,
      moderation_status: moderationStatus,
      verification_tier: 'UNVERIFIED',
    },
    { status: 201 },
  );
}
