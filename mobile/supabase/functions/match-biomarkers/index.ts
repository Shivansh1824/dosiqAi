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

interface TestResult {
  id: string;
  test_name: string;
  value: string;
  unit: string;
}

interface BiomarkerAlias {
  id: string;
  alias_name: string;
  biomarker_id: string; 
}

interface ExactMatchResult {
  test_name: string;
  biomarker_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { tests } = await req.json();

    if (!tests || !Array.isArray(tests) || tests.length === 0) {
       console.log("[Match-Biomarkers] No tests provided in payload.");
       return new Response(JSON.stringify({ success: true, message: "No tests to match" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Match-Biomarkers] Starting for ${tests.length} tests`);

    // 1. Fetch all Biomarker Aliases (fetching all for now to ensure we don't miss anything)
    // Optimization: In future, we could filter by the test names if the alias list grows too large.
    const { data: aliases, error: aliasError } = await supabase
      .from("biomarker_aliases")
      .select("id, alias_name, biomarker_id");

    if (aliasError || !aliases) throw new Error(`Failed to fetch aliases: ${aliasError?.message}`);

    const exactMatches: ExactMatchResult[] = [];
    const updatesToPerform: { id: string; biomarker_id: string }[] = [];

    // 2. Matching Logic - EXACT MATCH ONLY
    for (const test of (tests as TestResult[])) {
      if (!test.test_name) continue;

      // Normalize strings: lowercase, trim, and replace special chars with space for consistency
      // This handles "Hb-A1c" vs "Hb A1c" vs "Hb/A1c"
      const normalize = (str: string) => str.toLowerCase().replace(/[-/()]/g, " ").replace(/\s+/g, " ").trim();

      const normalizedTestName = normalize(test.test_name);
      
      // Check for exact match in aliases
      const exactMatch = (aliases as BiomarkerAlias[]).find(
        a => normalize(a.alias_name) === normalizedTestName
      );

      if (exactMatch) {
        console.log(`[Match] ✅ Exact match found: "${test.test_name}" -> Biomarker ID: ${exactMatch.biomarker_id}`);
        
        exactMatches.push({
          test_name: test.test_name,
          biomarker_id: exactMatch.biomarker_id
        });

        updatesToPerform.push({
          id: test.id,
          biomarker_id: exactMatch.biomarker_id
        });
      } else {
        console.log(`[Match] ❌ No exact match for: "${test.test_name}"`);
      }
    }

    // 3. Update Database
    if (updatesToPerform.length > 0) {
      console.log(`[Database] 💾 Updating ${updatesToPerform.length} test results with biomarker_id...`);
      
      // Perform updates one by one (or uspert if structure allowed, but update is safer here)
      // Since we need to update based on ID, strict updates are good.
      // Parallelizing updates for speed
      const updatePromises = updatesToPerform.map(update => 
        supabase
          .from("test_results")
          .update({ biomarker_id: update.biomarker_id })
          .eq("id", update.id)
      );

      await Promise.all(updatePromises);
      console.log(`[Database] ✅ Matches saved to database.`);
    }

    return new Response(JSON.stringify({
      success: true,
      matches: exactMatches.length,
      exact_matches: exactMatches
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Match-Biomarkers] Error: ${msg}`);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
