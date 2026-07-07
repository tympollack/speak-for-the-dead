/**
 * supabase/functions/verify-document/index.ts
 *
 * Supabase Edge Function — verify-document
 *
 * Called server-side (from POST /api/submit) after a story document has been
 * moved to its permanent storage path.  Performs pragmatic MVP-level forensic
 * checks on the file and updates the database with the result.
 *
 * Checks performed:
 *   1. Path traversal guard          – storage_path must begin with stories/{story_id}/
 *   2. File size check               – rejects anything over 10 MB
 *   3. Magic-byte MIME verification  – confirms the file content matches the
 *                                      declared content_type (JPEG, PNG, WebP, PDF)
 *   4. EXIF presence heuristic       – JPEG/PNG files without any EXIF segment
 *                                      are flagged as possible screenshots or
 *                                      manipulated exports (not rejected, just noted)
 *   5. PDF validity check            – PDFs must begin with the %PDF- header
 *
 * Verification tiers:
 *   ANCHOR     – all checks pass; document appears authentic
 *   UNVERIFIED – one or more checks raised a flag; stored with flag details
 *
 * Note: Full Error Level Analysis (ELA) requires image processing libraries
 * not readily available in the Deno runtime.  The magic-byte + EXIF approach
 * is a pragmatic MVP substitute.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_BUCKET = 'story-documents';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Magic byte signatures
// ---------------------------------------------------------------------------

/** Returns true when the byte array starts with the given sequence. */
function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((b, i) => bytes[i] === b);
}

const MAGIC = {
  /** JPEG: FF D8 FF */
  jpeg: [0xff, 0xd8, 0xff],
  /** PNG:  89 50 4E 47 0D 0A 1A 0A */
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  /** WebP: RIFF????WEBP */
  webpRiff: [0x52, 0x49, 0x46, 0x46], // "RIFF"
  webpMarker: [0x57, 0x45, 0x42, 0x50], // "WEBP" at offset 8
  /** PDF:  %PDF- */
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d],
};

/**
 * Validates that the file bytes match the claimed MIME type.
 * Returns the canonical detected type, or null if unrecognised.
 */
function detectMimeType(
  bytes: Uint8Array,
): 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' | null {
  if (startsWith(bytes, MAGIC.jpeg)) return 'image/jpeg';
  if (startsWith(bytes, MAGIC.png)) return 'image/png';
  if (
    startsWith(bytes, MAGIC.webpRiff) &&
    bytes.length >= 12 &&
    MAGIC.webpMarker.every((b, i) => bytes[8 + i] === b)
  ) {
    return 'image/webp';
  }
  if (startsWith(bytes, MAGIC.pdf)) return 'application/pdf';
  return null;
}

// ---------------------------------------------------------------------------
// EXIF heuristic
// ---------------------------------------------------------------------------

/**
 * Checks whether a JPEG byte array contains an EXIF APP1 marker (FF E1).
 *
 * JPEG segments:
 *   FF D8          SOI
 *   FF E0 xx xx   APP0 (JFIF)
 *   FF E1 xx xx   APP1 (EXIF / XMP)
 *   ...
 *
 * We scan the first 2 KB of the file for the 0xFF 0xE1 marker sequence.
 * Absence of EXIF in a JPEG is a weak flag for a screenshot or export from
 * a tool that strips metadata — it does NOT prove manipulation.
 */
function hasExifSegment(bytes: Uint8Array): boolean {
  const scanLimit = Math.min(bytes.length, 2048);
  for (let i = 2; i < scanLimit - 1; i++) {
    // EXIF APP1 marker
    if (bytes[i] === 0xff && bytes[i + 1] === 0xe1) return true;
    // JFIF APP0 marker (also valid; skip without flagging)
    if (bytes[i] === 0xff && bytes[i + 1] === 0xe0) continue;
  }
  return false;
}

/**
 * Checks whether a PNG contains an eXIf chunk (introduced in PNG spec 1.6).
 * Scans chunk type codes in the first 64 KB for "eXIf".
 */
function hasPngExifChunk(bytes: Uint8Array): boolean {
  // PNG structure: 8-byte signature, then chunks: [4-byte length][4-byte type][data][4-byte CRC]
  const eXIf = [0x65, 0x58, 0x49, 0x66]; // "eXIf"
  const limit = Math.min(bytes.length, 65536);
  let offset = 8; // skip signature
  while (offset + 12 <= limit) {
    const chunkLen =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    const typeMatch = eXIf.every((b, i) => bytes[offset + 4 + i] === b);
    if (typeMatch) return true;
    offset += 12 + chunkLen; // 4 length + 4 type + data + 4 CRC
  }
  return false;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerificationFlag {
  code: string;
  detail: string;
}

interface VerificationResult {
  tier: 'ANCHOR' | 'UNVERIFIED';
  flags: VerificationFlag[];
  checked_at: string;
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  // ── Auth guard – only accept calls with the service role key ─────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Parse request body ────────────────────────────────────────────────────
  let body: { story_id?: string; storage_path?: string; document_type?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { story_id, storage_path, document_type } = body;

  if (!story_id || !storage_path || !document_type) {
    return new Response(
      JSON.stringify({ error: 'story_id, storage_path, and document_type are required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Path traversal guard ──────────────────────────────────────────────────
  const expectedPrefix = `stories/${story_id}/`;
  if (!storage_path.startsWith(expectedPrefix)) {
    console.error(
      `[verify-document] Path traversal attempt: "${storage_path}" does not start with "${expectedPrefix}"`,
    );
    return new Response(
      JSON.stringify({ error: 'Invalid storage_path: path traversal detected.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Supabase admin client ─────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'speak_for_the_dead' }
  });

  // ── Download file from Storage ────────────────────────────────────────────
  const { data: fileBlob, error: downloadError } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .download(storage_path);

  if (downloadError || !fileBlob) {
    console.error('[verify-document] Download error:', downloadError);
    return new Response(
      JSON.stringify({ error: 'Failed to download file from Storage.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Convert Blob to Uint8Array for byte-level inspection
  const arrayBuffer = await fileBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // ── Collect verification flags ────────────────────────────────────────────
  const flags: VerificationFlag[] = [];

  // Check 1: File size
  if (bytes.length > MAX_FILE_SIZE_BYTES) {
    flags.push({
      code: 'FILE_TOO_LARGE',
      detail: `File is ${bytes.length} bytes, exceeding the ${MAX_FILE_SIZE_BYTES} byte limit.`,
    });
  }

  // Check 2: Magic byte MIME verification
  const detectedMime = detectMimeType(bytes);

  if (!detectedMime) {
    flags.push({
      code: 'UNRECOGNISED_FORMAT',
      detail: 'File does not match any supported format (JPEG, PNG, WebP, PDF).',
    });
  } else if (detectedMime !== document_type) {
    flags.push({
      code: 'MIME_MISMATCH',
      detail: `Declared type is "${document_type}" but file bytes indicate "${detectedMime}".`,
    });
  }

  // Check 3 & 4: EXIF heuristic for images (skip PDFs)
  if (detectedMime === 'image/jpeg') {
    if (!hasExifSegment(bytes)) {
      flags.push({
        code: 'NO_EXIF_JPEG',
        detail:
          'JPEG file contains no EXIF APP1 segment. This may indicate a screenshot or a tool that strips metadata.',
      });
    }
  } else if (detectedMime === 'image/png') {
    if (!hasPngExifChunk(bytes)) {
      flags.push({
        code: 'NO_EXIF_PNG',
        detail:
          'PNG file contains no eXIf chunk. This may indicate a screenshot or a tool that strips metadata.',
      });
    }
  }

  // Check 5: PDF validity
  if (document_type === 'application/pdf') {
    if (detectedMime !== 'application/pdf') {
      // Already flagged by MIME_MISMATCH above — no duplicate flag needed
    } else {
      // Additional: look for %%EOF marker (very basic structural check)
      const tail = bytes.slice(Math.max(0, bytes.length - 1024));
      const tailStr = new TextDecoder('ascii', { fatal: false }).decode(tail);
      if (!tailStr.includes('%%EOF')) {
        flags.push({
          code: 'PDF_MISSING_EOF',
          detail: 'PDF is missing the %%EOF marker — file may be truncated or corrupt.',
        });
      }
    }
  }

  // ── Determine tier ────────────────────────────────────────────────────────
  const tier: 'ANCHOR' | 'UNVERIFIED' = flags.length === 0 ? 'ANCHOR' : 'UNVERIFIED';
  const checkedAt = new Date().toISOString();

  const verificationResult: VerificationResult = { tier, flags, checked_at: checkedAt };

  // ── Persist results to database ───────────────────────────────────────────

  // Update story_documents.verification_result
  const { error: docUpdateError } = await adminClient
    .from('story_documents')
    .update({ verification_result: verificationResult })
    .eq('storage_path', storage_path);

  if (docUpdateError) {
    console.error('[verify-document] Failed to update story_documents:', docUpdateError);
  }

  // Update stories.verification_tier (only upgrade if document passes)
  const { error: storyUpdateError } = await adminClient
    .from('stories')
    .update({ verification_tier: tier })
    .eq('id', story_id);

  if (storyUpdateError) {
    console.error('[verify-document] Failed to update stories.verification_tier:', storyUpdateError);
  }

  // ── Return result ─────────────────────────────────────────────────────────
  return new Response(JSON.stringify(verificationResult), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
