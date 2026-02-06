/**
 * Supabase Edge Function: enrich-test-results
 *
 * Enriches lab test results with LOINC codes for standardization and future reference
 * 
 * Workflow:
 * 1. Receives AI analysis JSON from analyze-report
 * 2. Extracts test array from analysis
 * 3. For each test: searches LOINC API → uses AI to select best match
 * 4. Updates loinc_codes master table
 * 5. Creates lab_reports record and test_results records
 * 
 * Configuration (Edge Function Secrets):
 * - OPENROUTER_API_KEY: OpenRouter API key for AI LOINC selection
 * 
 * Request Payload:
 * {
 *   "documentId": "uuid-of-document",
 *   "analysisResult": { ... AI analysis JSON ... },
 *   "userId": "uuid-of-user"
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   labReportId?: string;
 *   testCount?: number;
 *   loincCodesAdded?: number;
 *   error?: string;
 * }
 */

import { serve } from "std/http/server.ts";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Environment variables
const _OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// LOINC API configuration
const LOINC_API_BASE = "https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// OpenRouter configuration for AI LOINC selection (for future use)
const _OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const _MODEL = "google/gemini-3-flash-preview";
const _MAX_TOKENS_LOINC_SELECT = 2000;

// Request/Response interfaces
interface EnrichTestResultsRequest {
  documentId: string;
  analysisResult: Record<string, unknown>;
  userId: string;
}

interface LoincCandidate {
  code: string;
  name: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

/**
 * Search LOINC API for test name
 */
async function searchLoincAPI(testName: string, retryCount: number = 0): Promise<LoincCandidate[]> {
  try {
    const url = `${LOINC_API_BASE}?terms=${encodeURIComponent(testName)}&ef=LOINC_NUM&type=question&maxList=10`;
    console.log(`[LOINC-API] Searching for: "${testName}" (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[LOINC-API] Error (${response.status})`);
      
      if ([429, 500, 502, 503].includes(response.status) && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * (retryCount + 1);
        console.log(`[LOINC-API] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return searchLoincAPI(testName, retryCount + 1);
      }
      
      return [];
    }

    const data = await response.json();
    
    // Parse response format: [count, [display_names], null, [loinc_codes]]
    if (Array.isArray(data) && data.length >= 4 && Array.isArray(data[1]) && Array.isArray(data[3])) {
      const names = data[1] as string[];
      const codes = data[3] as string[][];
      
      const candidates: LoincCandidate[] = [];
      for (let i = 0; i < names.length && i < codes.length; i++) {
        if (codes[i] && codes[i][0]) {
          candidates.push({
            code: codes[i][0],
            name: names[i],
          });
        }
      }
      
      console.log(`[LOINC-API] Found ${candidates.length} candidates for "${testName}"`);
      return candidates;
    }
    
    console.log(`[LOINC-API] No results found for "${testName}"`);
    return [];
  } catch (error) {
    console.error(`[LOINC-API] Exception:`, error);
    
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * (retryCount + 1);
      console.log(`[LOINC-API] Network error, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return searchLoincAPI(testName, retryCount + 1);
    }
    
    return [];
  }
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  let documentId: string | undefined;
  let supabase: SupabaseClient | undefined;

  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[ENRICH] 🧬 LOINC ENRICHMENT STARTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Initialize Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("[Auth] User authentication failed:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: EnrichTestResultsRequest = await req.json();
    const { documentId: docId, analysisResult, userId } = body;
    documentId = docId;

    console.log(`[ENRICH] Document: ${documentId}`);
    console.log(`[ENRICH] User: ${userId}`);

    // Validate required fields
    if (!documentId || !analysisResult || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: documentId, analysisResult, userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user matches
    if (user.id !== userId) {
      return new Response(
        JSON.stringify({ error: "User ID mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract tests array from analysis result
    const tests = Array.isArray(analysisResult.tests) ? analysisResult.tests : [];
    
    if (tests.length === 0) {
      console.log('[ENRICH] No tests found in analysis result');
      return new Response(
        JSON.stringify({
          success: true,
          message: "No tests to enrich",
          testCount: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[ENRICH] Found ${tests.length} tests to process`);

    // 1. Loop through each test and search LOINC API
    const enrichmentResults: { name: string; loinc_codes: string; loinc_names: string }[] = [];
    
    // We process sequentially to avoid hitting API rate limits too hard, 
    // or we could do Promise.all with concurrency limit if needed.
    // Given the user wants "all possible results", sequential is safer for now.
    
    console.log(`[ENRICH] Processing ${tests.length} tests...`);

    for (const test of tests) {
      if (!test.name) {
        continue;
      }
      
      const testName = String(test.name).trim();
      if (!testName) continue;
      
      // Search API
      // Note: We use the helper function defined below
      const candidates = await searchLoincAPI(testName);
      
      // Format results as requested: comma-separated strings
      // Note: Based on API observation, the 'name' field (index 1) actually contains the LOINC Code,
      // and the 'code' field (index 3/extra info) contains the text/short name.
      // So we swap them here to produce the correct output.
      const loincCodes = candidates.map((c: LoincCandidate) => c.name).join(",");
      const loincNames = candidates.map((c: LoincCandidate) => c.code).join(",");
      
      enrichmentResults.push({
        name: testName,
        loinc_codes: loincCodes || "null",
        loinc_names: loincNames || "null"
      });
      
      // Small delay to be nice to the API
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[ENRICH] Enriched ${enrichmentResults.length} tests`);

    // 2. Store in debug_logs table
    const debugLogData = {
      original_test_count: tests.length,
      enriched_test_count: enrichmentResults.length,
      results: enrichmentResults
    };

    const { error: logError } = await supabase
      .from("debug_logs")
      .insert({
        source: "enrich-test-results",
        document_id: documentId,
        data: debugLogData,
        log_level: "INFO"
      });
      
    if (logError) {
      console.error("[ENRICH] Failed to write to debug_logs:", logError);
    } else {
      console.log("[ENRICH] ✅ Results saved to debug_logs table");
    }

    // TODO: Future steps (AI selection, update loinc_codes, update lab_reports, update test_results)
    // For now, we stop here as requested.

    const duration = Date.now() - startTime;

    console.log(`[ENRICH] ✅ Enrichment flow completed in ${duration}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Return success response with the results
    return new Response(
      JSON.stringify({
        success: true,
        message: "Test enrichment completed (debug mode)",
        testCount: tests.length,
        enrichedResults: enrichmentResults,
        duration,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[Error] Test enrichment failed:", error);

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        duration,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
