/**
 * app/api/upload-token/route.ts
 *
 * POST /api/upload-token
 *
 * Issues a short-lived signed upload URL so the client can PUT a document
 * directly to Supabase Storage — bypassing the Next.js server for the file
 * bytes (avoids large-body API route timeouts and memory pressure).
 *
 * Flow:
 *   1. Validate MIME type and file size on the server (client claims are untrusted).
 *   2. Generate a random stagingId and a sanitised storage path.
 *   3. Create a Supabase admin client (service role key — never sent to browser).
 *   4. Create a signed upload URL via the Storage API.
 *   5. Record the pending upload in `document_staging`.
 *   6. Return { signedUrl, stagingId, path } to the client.
 *
 * The client then PUTs the file to `signedUrl` directly.  After the PUT the
 * client proceeds to POST /api/submit with the stagingId, which moves the
 * file to its permanent path and records it in `story_documents`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Allowed MIME types for story-supporting documents. */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

/** Maximum accepted file size in bytes (10 MB). */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Supabase Storage bucket that holds all story documents. */
const STORAGE_BUCKET = 'story-documents';

/** How long (in seconds) the signed upload URL remains valid. */
const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Admin client factory (service role — server-only)
// ---------------------------------------------------------------------------

function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.',
    );
  }

  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'speak_for_the_dead' }
  });
}

// ---------------------------------------------------------------------------
// Filename sanitisation
// ---------------------------------------------------------------------------

/**
 * Returns a storage-safe version of a user-supplied filename.
 *
 * Rules applied:
 *   • Spaces → underscores
 *   • Strip any character that is not alphanumeric, dot, dash, or underscore
 *   • Collapse consecutive underscores
 *   • Trim leading/trailing dots and underscores
 */
function sanitiseFilename(raw: string): string {
  return raw
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    || 'document'; // Fallback if everything was stripped
}

// ---------------------------------------------------------------------------
// Request body schema
// ---------------------------------------------------------------------------

const UploadTokenRequestSchema = z.object({
  /** Original filename as selected by the user (will be sanitised server-side). */
  filename: z
    .string()
    .min(1, 'filename is required.')
    .max(255, 'filename must be 255 characters or fewer.'),

  /** MIME type claimed by the client — validated against ALLOWED_MIME_TYPES. */
  contentType: z.enum(ALLOWED_MIME_TYPES, {
    error: `contentType must be one of: ${ALLOWED_MIME_TYPES.join(', ')}.`,
  }),

  /** File size in bytes as reported by the client — hard-capped at 10 MB. */
  fileSize: z
    .number()
    .int()
    .positive('fileSize must be a positive integer.')
    .max(
      MAX_FILE_SIZE_BYTES,
      `File size must not exceed ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
    ),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Parse & validate request ─────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  let input: z.infer<typeof UploadTokenRequestSchema>;
  try {
    input = UploadTokenRequestSchema.parse(body);
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

  const { filename, contentType } = input;

  // ── 2. Generate staging identifiers ──────────────────────────────────────
  const stagingId = crypto.randomUUID();
  const safeFilename = sanitiseFilename(filename);
  const storagePath = `staging/${stagingId}/${safeFilename}`;

  // ── 3. Create signed upload URL via Supabase Storage ─────────────────────
  let adminClient: ReturnType<typeof getAdminClient>;
  try {
    adminClient = getAdminClient();
  } catch (err) {
    console.error('[/api/upload-token] Admin client init failed:', err);
    return NextResponse.json(
      { error: 'server_configuration', message: 'Server configuration error.' },
      { status: 500 },
    );
  }

  const { data: signedUrlData, error: signedUrlError } =
    await adminClient.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error('[/api/upload-token] Failed to create signed URL:', signedUrlError);
    return NextResponse.json(
      {
        error: 'storage_error',
        message: 'Failed to generate upload URL. Please try again.',
      },
      { status: 502 },
    );
  }

  // ── 4. Record pending upload in document_staging ──────────────────────────
  const { error: dbError } = await adminClient
    .from('document_staging')
    .insert({
      id: stagingId,
      storage_path: storagePath,
      content_type: contentType,
      // claimed_by_story_id intentionally left null until /api/submit claims it
    });

  if (dbError) {
    console.error('[/api/upload-token] Failed to insert document_staging row:', dbError);
    return NextResponse.json(
      {
        error: 'database_error',
        message: 'Failed to register upload. Please try again.',
      },
      { status: 502 },
    );
  }

  // ── 5. Return signed URL to client ────────────────────────────────────────
  return NextResponse.json(
    {
      signedUrl: signedUrlData.signedUrl,
      stagingId,
      path: storagePath,
    },
    { status: 200 },
  );
}
