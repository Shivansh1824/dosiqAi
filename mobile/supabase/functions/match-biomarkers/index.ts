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
// INTERFACES
// ═══════════════════════════════════════════════════════════════

interface TestResult {
  id: string;
  test_name: string;
  value: string;
  unit: string;
  interpretation?: string;
}

interface BiomarkerAlias {
  id: string;
  alias_name: string;
  biomarker_id: string;
}

// --- Output JSON Types ---

interface ExactMatchResult {
  test_name: string;
  biomarker_id: string;
}

interface FuzzyCandidate {
  score: number;
  alias_name: string;
  biomarker_id: string;
  mastertable_interpretation: string;
}

interface FuzzyMatchResult {
  test_name: string;
  original_interpretation: string | null;
  fuzzy_candidates: FuzzyCandidate[];
}

interface NotFoundResult {
  test_name: string;
  db_interpretation: string | null;
  value: string | null;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] 🚀 Match-Biomarkers invoked`);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const tests = body.tests;

    if (!tests || !Array.isArray(tests) || tests.length === 0) {
       console.log(`[${requestId}] ⚠️ No tests provided in payload:`, JSON.stringify(body));
       return new Response(JSON.stringify({ success: true, message: "No tests to match" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] 📋 Processing ${tests.length} tests: ${tests.map((t: TestResult) => t.test_name).join(", ")}`);

    // ─────────────────────────────────────────────────────────
    // Step 0: Fetch all Biomarker Aliases (for exact matching)
    // ─────────────────────────────────────────────────────────
    const { data: aliases, error: aliasError } = await supabase
      .from("biomarkers_aliases")
      .select("id, alias_name, biomarker_id");

    if (aliasError || !aliases) {
      console.error(`[${requestId}] ❌ Failed to fetch aliases:`, aliasError);
      throw new Error(`Alias fetch failed: ${aliasError?.message}`);
    }

    // Result arrays
    const exactMatches: ExactMatchResult[] = [];
    const fuzzyMatches: FuzzyMatchResult[] = [];
    const notFound: NotFoundResult[] = [];
    const updatesToPerform: { id: string; biomarker_id: string }[] = [];

    // Normalize helper: lowercase, replace special chars, collapse spaces
    const normalize = (str: string) => str.toLowerCase().replace(/[-/()]/g, " ").replace(/\s+/g, " ").trim();

    // ─────────────────────────────────────────────────────────
    // Step 1-3: Loop each test → Exact → Fuzzy → Not Found
    // ─────────────────────────────────────────────────────────
    for (const test of (tests as TestResult[])) {
      if (!test.test_name) continue;

      const normalizedTestName = normalize(test.test_name);

      // ─── QUERY 1: EXACT MATCH ───
      const exactMatch = (aliases as BiomarkerAlias[]).find(
        a => normalize(a.alias_name) === normalizedTestName
      );

      if (exactMatch) {
        console.log(`[${requestId}][Exact] ✅ "${test.test_name}" -> ID: ${exactMatch.biomarker_id}`);
        
        exactMatches.push({
          test_name: test.test_name,
          biomarker_id: exactMatch.biomarker_id
        });

        updatesToPerform.push({
          id: test.id,
          biomarker_id: exactMatch.biomarker_id
        });

        // Exact match found — skip fuzzy and not-found for this test
        continue;
      }

      // ─── QUERY 2: FUZZY SEARCH (pg_trgm) ───
      console.log(`[${requestId}][Fuzzy] 🔍 Trying "${test.test_name}"...`);

      const { data: fuzzyResults, error: fuzzyError } = await supabase
        .rpc("search_biomarker_fuzzy", {
          search_term: test.test_name,
        });

      if (fuzzyError) {
        console.error(`[${requestId}][Fuzzy] ❌ Error for "${test.test_name}":`, fuzzyError);
        // On error, fall through to not-found
      }

      if (fuzzyResults && fuzzyResults.length > 0) {
        console.log(`[${requestId}][Fuzzy] 🔎 Found ${fuzzyResults.length} candidates for "${test.test_name}"`);
        // Log individual candidates for manual verification
        fuzzyResults.forEach((r: FuzzyCandidate, i: number) => {
          console.log(`  [#${i+1}] ${r.alias_name} (Score: ${r.score.toFixed(4)})`);
        });
        
        fuzzyMatches.push({
          test_name: test.test_name,
          original_interpretation: test.interpretation || null,
          fuzzy_candidates: fuzzyResults.map((r: { score: number; alias_name: string; biomarker_id: string; mastertable_interpretation: string }) => ({
            score: parseFloat(r.score.toFixed(4)),
            alias_name: r.alias_name,
            biomarker_id: r.biomarker_id,
            mastertable_interpretation: r.mastertable_interpretation,
          })),
        });

        // Fuzzy match found — skip not-found for this test
        continue;
      }

      // ─── QUERY 3: NOT FOUND ───
      console.log(`[${requestId}][NotFound] ❓ "${test.test_name}"`);

      notFound.push({
        test_name: test.test_name,
        db_interpretation: test.interpretation || null,
        value: test.value || null,
      });
    }

    // ─────────────────────────────────────────────────────────
    // Step 4: Update Database (exact matches only)
    // ─────────────────────────────────────────────────────────
    if (updatesToPerform.length > 0) {
      console.log(`[${requestId}][DB] 💾 Updating ${updatesToPerform.length} test_results...`);
      
      const results = await Promise.all(
        updatesToPerform.map(update => 
          supabase
            .from("test_results")
            .update({ biomarker_id: update.biomarker_id })
            .eq("id", update.id)
        )
      );

      const failures = results.filter(r => r.error);
      if (failures.length > 0) {
        console.error(`[${requestId}][DB] ❌ ${failures.length} updates failed:`, failures.map(f => f.error));
      } else {
        console.log(`[${requestId}][DB] ✅ All updates saved.`);
      }
    }

    // ─────────────────────────────────────────────────────────
    // Step 5: Save Debug Logs (Temporary for testing)
    // ─────────────────────────────────────────────────────────
    const firstTestId = tests[0]?.id;
    if (firstTestId) {
      console.log(`[${requestId}][Debug] 📝 Logging results (Ref: ${firstTestId})...`);
      const { error: debugError } = await supabase
        .from("biomarker_debug_logs")
        .insert({
          test_reference: firstTestId,
          exact_matches: exactMatches,
          fuzzy_matches: fuzzyMatches,
          not_found: notFound
        });
      
      if (debugError) {
        console.error(`[${requestId}][Debug] ❌ Insert failed:`, debugError);
      } else {
        console.log(`[${requestId}][Debug] ✅ Logs saved.`);
      }
    }

    // ─────────────────────────────────────────────────────────
    // Step 6: Return all 3 JSON arrays
    // ─────────────────────────────────────────────────────────
    console.log(`[${requestId}] ✅ Finished. Exact: ${exactMatches.length}, Fuzzy: ${fuzzyMatches.length}, NotFound: ${notFound.length}`);

    return new Response(JSON.stringify({
      success: true,
      counts: {
        exact: exactMatches.length,
        fuzzy: fuzzyMatches.length,
        not_found: notFound.length,
      },
      exact_matches: exactMatches,
      fuzzy_matches: fuzzyMatches,
      not_found: notFound,
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
