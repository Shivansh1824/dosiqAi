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
  id: string;
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
  id: string;
  test_name: string;
  value: string;
  original_interpretation: string | null;
  fuzzy_candidates: FuzzyCandidate[];
}

interface NotFoundResult {
  id: string;
  test_name: string;
  db_interpretation: string | null;
  value: string;
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

    // Normalize helper: lowercase, replace special chars, collapse spaces
    const normalize = (str: string) => str.toLowerCase().replace(/[-/()]/g, " ").replace(/\s+/g, " ").trim();

    // ─────────────────────────────────────────────────────────
    // Step 1-3: Loop each test → Exact → Fuzzy → Not Found
    // ─────────────────────────────────────────────────────────
    for (const test of (tests as TestResult[])) {
      if (!test.test_name) continue;

      // ─── NUMERIC FILTER ───
      const rawValue = test.value;
      const strippedValue = (typeof rawValue === "string") ? rawValue.replace(/%/g, "").trim() : rawValue;

      // Ensure 0 is accepted, but null, undefined, empty string, or non-numeric text is skipped
      const isNumeric = strippedValue !== null &&
        strippedValue !== undefined &&
        strippedValue !== "" &&
        !isNaN(Number(strippedValue));

      if (!isNumeric) {
        console.log(`[${requestId}][Skip] ⏭️ Skipping "${test.test_name}" because value "${test.value}" is not numeric.`);
        continue;
      }

      const valueWithUnit = test.unit ? `${test.value} ${test.unit}` : test.value;
      const normalizedTestName = normalize(test.test_name);

      // ─── QUERY 1: EXACT MATCH ───
      const exactMatch = (aliases as BiomarkerAlias[]).find(
        a => normalize(a.alias_name) === normalizedTestName
      );

      if (exactMatch) {
        console.log(`[${requestId}][Exact] ✅ "${test.test_name}" -> ID: ${exactMatch.biomarker_id}`);

        exactMatches.push({
          id: test.id,
          test_name: test.test_name,
          biomarker_id: exactMatch.biomarker_id,
          value: valueWithUnit,
          db_interpretation: test.interpretation || ""
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
          console.log(`  [#${i + 1}] ${r.alias_name} (Score: ${r.score.toFixed(4)})`);
        });

        fuzzyMatches.push({
          id: test.id,
          test_name: test.test_name,
          value: valueWithUnit,
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
        id: test.id,
        test_name: test.test_name,
        db_interpretation: test.interpretation || null,
        value: valueWithUnit,
      });
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
    // Step 7: Trigger process-biomarkers function (Fire-and-Forget)
    // ─────────────────────────────────────────────────────────
    const processFunctionUrl = `${SUPABASE_URL}/functions/v1/process-biomarkers`;
    const authHeader = req.headers.get("Authorization");

    const triggerProcessor = async () => {
      try {
        console.log(`[Trigger] 🚀 Invoking process-biomarkers (Async)`);
        const processRes = await fetch(processFunctionUrl, {
          method: "POST",
          headers: {
            "Authorization": authHeader || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            success: true,
            counts: {
              exact: exactMatches.length,
              fuzzy: fuzzyMatches.length,
              not_found: notFound.length,
            },
            exact_matches: exactMatches,
            fuzzy_matches: fuzzyMatches,
            not_found: notFound,
          }),
        });

        console.log(`[Trigger] 📡 Process-biomarkers response: ${processRes.status}`);
        if (!processRes.ok) {
          const errText = await processRes.text();
          console.error(`[Trigger] ❌ Process function error: ${errText.substring(0, 200)}`);
        }
      } catch (err) {
        console.error(`[Trigger] ❌ Failed to invoke process-biomarkers: ${err}`);
      }
    };

    // Use EdgeRuntime.waitUntil to keep the function alive after returning response
    // @ts-ignore
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(triggerProcessor());
    } else {
      console.warn(`[Trigger] ⚠️ EdgeRuntime.waitUntil not found, executing without await`);
      triggerProcessor();
    }

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
