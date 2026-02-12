import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════
// INTERFACES (from match-biomarkers output)
// ═══════════════════════════════════════════════════════════════

interface ExactMatchResult {
  test_name: string;
  biomarker_id: string;
  value: string;
  db_interpretation: string;
}

interface FuzzyCandidate {
  score: number;
  alias_name: string;
  biomarker_id: string;
  mastertable_interpretation: string;
}

interface FuzzyMatchResult {
  test_name: string;
  value: string;
  original_interpretation: string | null;
  fuzzy_candidates: FuzzyCandidate[];
}

interface NotFoundResult {
  test_name: string;
  db_interpretation: string | null;
  value: string;
}

interface MatchBiomarkersPayload {
  success: boolean;
  counts: {
    exact: number;
    fuzzy: number;
    not_found: number;
  };
  exact_matches: ExactMatchResult[];
  fuzzy_matches: FuzzyMatchResult[];
  not_found: NotFoundResult[];
}

// ═══════════════════════════════════════════════════════════════
// PROCESSING FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Process exact-matched biomarkers.
 * These have a confirmed biomarker_id from the alias table.
 */
async function processExactMatches(
  _supabase: ReturnType<typeof createClient>,
  exactMatches: ExactMatchResult[],
  requestId: string
): Promise<void> {
  console.log(`[${requestId}][Exact] Processing ${exactMatches.length} exact matches...`);
  // TODO: Implement exact match processing logic
}

/**
 * Process fuzzy-matched biomarkers.
 * These have candidate suggestions but need resolution.
 */
async function processFuzzyMatches(
  _supabase: ReturnType<typeof createClient>,
  fuzzyMatches: FuzzyMatchResult[],
  requestId: string
): Promise<void> {
  console.log(`[${requestId}][Fuzzy] Processing ${fuzzyMatches.length} fuzzy matches...`);
  // TODO: Implement fuzzy match processing logic
}

/**
 * Process not-found biomarkers.
 * These had no match in the database at all.
 */
async function processNotFound(
  _supabase: ReturnType<typeof createClient>,
  notFound: NotFoundResult[],
  requestId: string
): Promise<void> {
  console.log(`[${requestId}][NotFound] Processing ${notFound.length} not-found items...`);
  // TODO: Implement not-found processing logic
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] 🚀 Process-Biomarkers invoked`);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: MatchBiomarkersPayload = await req.json();

    if (!payload.success) {
      console.log(`[${requestId}] ⚠️ Received unsuccessful payload, skipping.`);
      return new Response(JSON.stringify({ success: false, message: "Upstream matching failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] 📋 Received — Exact: ${payload.counts.exact}, Fuzzy: ${payload.counts.fuzzy}, NotFound: ${payload.counts.not_found}`);

    // ─────────────────────────────────────────────────────────
    // Run all three processors
    // ─────────────────────────────────────────────────────────
    await processExactMatches(supabase, payload.exact_matches, requestId);
    await processFuzzyMatches(supabase, payload.fuzzy_matches, requestId);
    await processNotFound(supabase, payload.not_found, requestId);

    // ─────────────────────────────────────────────────────────
    // Return summary
    // ─────────────────────────────────────────────────────────
    console.log(`[${requestId}] ✅ All processing complete.`);

    return new Response(JSON.stringify({
      success: true,
      message: "All biomarkers processed",
      processed: {
        exact: payload.counts.exact,
        fuzzy: payload.counts.fuzzy,
        not_found: payload.counts.not_found,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] 🛑 CRITICAL ERROR:`, error);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
