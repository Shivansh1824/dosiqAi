import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { NOT_FOUND_PROMPT } from "./prompt_not_found.ts";
import { FUZZY_PROMPT } from "./prompt_fuzzy.ts";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

// OpenRouter Configuration (same model & settings as analyze-report)
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const MAX_TOKENS = 4000;

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
  usage: {
    total_tokens: number;
  };
}

/**
 * Call OpenRouter API with text-only prompt (no image)
 * Uses same model, credentials, and retry logic as analyze-report
 */
async function callOpenRouterAPI(
  systemPrompt: string,
  userMessage: string,
  model: string = DEFAULT_MODEL,
  retryCount: number = 0
): Promise<OpenRouterResponse> {
  try {
    console.log(`[OpenRouter] 📤 Calling ${model} (Attempt ${retryCount + 1})`);

    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dosiq.ai",
        "X-Title": "dosiqAi",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        reasoning: {
          enabled: true,
          effort: "low",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenRouter] ❌ API error (${response.status}):`, errorText);

      if ([429, 500, 502, 503, 504].includes(response.status) && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
        await new Promise(r => setTimeout(r, delay));
        return callOpenRouterAPI(systemPrompt, userMessage, model, retryCount + 1);
      }
      throw new Error(`OpenRouter API failed: ${response.status}`);
    }

    return await response.json();
  } catch (err: unknown) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(`[OpenRouter] 🔄 Network error, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return callOpenRouterAPI(systemPrompt, userMessage, model, retryCount + 1);
    }
    throw err;
  }
}

function parseJSON(text: string) {
  try {
    const cleanJson = text.replace(/```json\s*|\s*```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Parser] ❌ Failed to parse response:", msg);
    return { raw: text, error: "JSON Parse failed" };
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════
// INTERFACES (from match-biomarkers output)
// ═══════════════════════════════════════════════════════════════

interface ExactMatchResult {
  id: string;
  test_name: string;
  biomarker_id: string;
  value: string | number;
  unit: string | null;
  ref_min: number | null;
  ref_max: number | null;
  ref_type: string | null;
  status: string | null;
}

interface FuzzyCandidate {
  score: number;
  alias_name: string;
  biomarker_id: string;
  mastertable_description: string;
}

interface FuzzyMatchResult {
  id: string;
  test_name: string;
  value: string | number;
  unit: string | null;
  ref_min: number | null;
  ref_max: number | null;
  ref_type: string | null;
  status: string | null;
  fuzzy_candidates: FuzzyCandidate[];
}

interface NotFoundResult {
  id: string;
  test_name: string;
  value: string | number;
  unit: string | null;
  ref_min: number | null;
  ref_max: number | null;
  ref_type: string | null;
  status: string | null;
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
  supabase: any,
  exactMatches: ExactMatchResult[],
  requestId: string
): Promise<void> {
  console.log(`[${requestId}][Exact] Processing ${exactMatches.length} exact matches...`);

  for (const match of exactMatches) {
    try {
      const { error } = await supabase
        .from("test_results")
        .update({ biomarker_id: match.biomarker_id })
        .eq("id", match.id);

      if (error) {
        console.error(`[${requestId}][Exact] Error updating result ${match.id}:`, error.message);
      } else {
        console.log(`[${requestId}][Exact] Successfully updated ${match.test_name} (${match.id}) with biomarker_id: ${match.biomarker_id}`);
      }
    } catch (err) {
      console.error(`[${requestId}][Exact] Unexpected error updating result ${match.id}:`, err);
    }
  }
}

/**
 * Look up fuzzy match records by their IDs and return them as NotFoundResult[].
 * Strips fuzzy_candidates so the data fits the processNotFound pipeline.
 */
function lookupFuzzyById(
  ids: string[],
  fuzzyMatches: FuzzyMatchResult[]
): NotFoundResult[] {
  return ids
    .map((id) => {
      const match = fuzzyMatches.find((m) => m.id === id);
      if (!match) return null;
      return {
        id: match.id,
        test_name: match.test_name,
        value: match.value,
        unit: match.unit,
        ref_min: match.ref_min,
        ref_max: match.ref_max,
        ref_type: match.ref_type,
        status: match.status,
      };
    })
    .filter((item): item is NotFoundResult => item !== null);
}

/**
 * Process fuzzy-matched biomarkers.
 * These have candidate suggestions but need AI resolution via Grok.
 * After AI resolution:
 *   - "found" items → update test_results with biomarker_id
 *   - "not_found" items → enrich with original data and route to processNotFound
 */
async function processFuzzyMatches(
  supabase: any,
  fuzzyMatches: FuzzyMatchResult[],
  requestId: string
): Promise<void> {
  if (fuzzyMatches.length === 0) {
    console.log(`[${requestId}][Fuzzy] No fuzzy matches to process.`);
    return;
  }

  console.log(`[${requestId}][Fuzzy] Processing ${fuzzyMatches.length} fuzzy matches via AI...`);

  try {
    // 1. Prepare the user message (full fuzzy_matches array with candidates)
    const userMessage = JSON.stringify(fuzzyMatches, null, 2);
    const model = "x-ai/grok-4.1-fast";

    // 2. Call Grok AI via OpenRouter
    const openRouterResponse = await callOpenRouterAPI(FUZZY_PROMPT, userMessage, model);
    const content = openRouterResponse.choices[0]?.message?.content;

    if (!content) {
      console.warn(`[${requestId}][Fuzzy] AI returned empty response.`);
      return;
    }

    // [DEBUG] Log the full content
    console.log(`[${requestId}][Fuzzy] Full AI Response:`, content);

    // 3. Parse the AI response
    const result = parseJSON(content);

    const found = Array.isArray(result?.found) ? result.found : [];
    const notFound = Array.isArray(result?.not_found) ? result.not_found : [];

    console.log(`[${requestId}][Fuzzy] AI resolved ${fuzzyMatches.length} -> ${found.length} found, ${notFound.length} not found.`);

    // 4. Handle found items — update test_results with biomarker_id
    for (const item of found) {
      const { error } = await supabase
        .from("test_results")
        .update({ biomarker_id: item.biomarker_id })
        .eq("id", item.id);

      if (error) {
        console.error(`[${requestId}][Fuzzy] Error updating ${item.id}:`, error.message);
      } else {
        console.log(`[${requestId}][Fuzzy] Updated ${item.id} with biomarker_id: ${item.biomarker_id}`);
      }
    }

    // 4.5. Upsert found items into potential_biomarker table
    if (found.length > 0) {
      console.log(`[${requestId}][Fuzzy] Upserting ${found.length} matched items into potential_biomarker...`);
      const potentialData = found.map((item: any) => {
        const original = fuzzyMatches.find((m) => m.id === item.id);
        return {
          test_results_id: item.id,
          test_name: original?.test_name,
          source: "fuzzy",
        };
      }).filter((item: any) => item.test_name);

      if (potentialData.length > 0) {
        const { error: upsertErr } = await supabase
          .from("potential_biomarker")
          .upsert(potentialData, { onConflict: "test_name" });

        if (upsertErr) {
          console.error(`[${requestId}][Fuzzy] Error upserting into potential_biomarker:`, upsertErr.message);
        } else {
          console.log(`[${requestId}][Fuzzy] Successfully upserted ${potentialData.length} biomarkers.`);
        }
      }
    }

    // 5. Handle not_found items — enrich with original data and route to processNotFound
    if (notFound.length > 0) {
      const notFoundIds = notFound.map((item: any) => item.id);
      const enrichedNotFound = lookupFuzzyById(notFoundIds, fuzzyMatches);
      console.log(`[${requestId}][Fuzzy] Routing ${enrichedNotFound.length} unmatched items to NotFound pipeline...`);
      await processNotFound(supabase, enrichedNotFound, requestId, "fuzzy_not_found");
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${requestId}][Fuzzy] AI processing failed:`, msg);
  }
}

/**
 * Process not-found biomarkers.
 * These had no match in the database at all.
 */
async function processNotFound(
  _supabase: any,
  notFound: NotFoundResult[],
  requestId: string,
  sourceOverride?: string
): Promise<void> {
  if (notFound.length === 0) {
    console.log(`[${requestId}][NotFound] No not-found items to process.`);
    return;
  }

  console.log(`[${requestId}][NotFound] Processing ${notFound.length} not-found items via AI...`);

  try {
    // 1. Prepare the user message (part of the JSON payload)
    const userMessage = JSON.stringify(notFound, null, 2);
    const model = "x-ai/grok-4.1-fast";

    // 2. Call OpenRouter AI
    const openRouterResponse = await callOpenRouterAPI(NOT_FOUND_PROMPT, userMessage, model);
    const content = openRouterResponse.choices[0]?.message?.content;

    if (!content) {
      console.warn(`[${requestId}][NotFound] AI returned empty response.`);
      return;
    }

    // [DEBUG] Log the full content as requested by the user
    console.log(`[${requestId}][NotFound] Full AI Response:`, content);

    // 3. Parse the filtered list of IDs
    const result = parseJSON(content);

    // Robust parsing: handle both array and object { "biomarkers": [...] } or { "ids": [...] }
    let filteredIds: string[] = [];
    if (Array.isArray(result)) {
      filteredIds = result.map((item: any) => item.id).filter(id => id);
    } else if (result && typeof result === "object") {
      // Look for common keys if it's an object
      const data = result.biomarkers || result.ids || result.items || [];
      if (Array.isArray(data)) {
        filteredIds = data.map((item: any) => typeof item === "string" ? item : item.id).filter(id => id);
      }
    }

    console.log(`[${requestId}][NotFound] AI filtered ${notFound.length} -> ${filteredIds.length} biomarkers to keep.`);

    // 4. Upsert into potential_biomarker table (Insert or Update)
    if (filteredIds.length > 0) {
      console.log(`[${requestId}][NotFound] Upserting ${filteredIds.length} items into potential_biomarker...`);

      const upsertData = filteredIds.map((id: string) => {
        const originalItem = notFound.find(item => item.id === id);
        return {
          test_results_id: id,
          test_name: originalItem?.test_name,
          source: sourceOverride || "not_found",
        };
      }).filter((item): item is { test_results_id: string; test_name: string; source: string } => !!item.test_name);

      const { error: upsertErr } = await _supabase
        .from("potential_biomarker")
        .upsert(upsertData, { onConflict: "test_name" });

      if (upsertErr) {
        console.error(`[${requestId}][NotFound] Error upserting into potential_biomarker:`, upsertErr.message);
        console.error(`[${requestId}][NotFound] Failed data:`, JSON.stringify(upsertData));
      } else {
        console.log(`[${requestId}][NotFound] Successfully upserted ${filteredIds.length} biomarkers for review.`);
      }
    } else {
      console.log(`[${requestId}][NotFound] No biomarkers met the tracking criteria. Skipping insertion.`);
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${requestId}][NotFound] AI processing failed:`, msg);
  }
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
