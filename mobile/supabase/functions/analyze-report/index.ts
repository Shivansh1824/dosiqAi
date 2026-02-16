/**
 * Supabase Edge Function: analyze-report
 *
 * Analyzes uploaded lab report documents using OpenRouter API (Google Gemini 2.0 Flash)
 * Analyzes uploaded lab report documents using OpenRouter API (Google Gemini 2.0 Flash)
 */

import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { REPORT_PROMPT } from "./prompt.ts";

// Environment variables
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
// const REPORT_PROMPT = Deno.env.get("REPORT_PROMPT") || "";

// R2 Configuration (for downloading files from Cloudflare R2)
const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const _R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";

// Configuration
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

// Token limit
const MAX_TOKENS_REPORT = 20000;

// CORS Headers - Extended for better client compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Max-Age": "86400",
};

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
 * Call OpenRouter API with robust retry logic
 */
async function callOpenRouterAPI(
  base64Image: string,
  fileType: string,
  prompt: string,
  retryCount: number = 0
): Promise<OpenRouterResponse> {
  try {
    console.log(`[OpenRouter] 📤 Calling Gemini 3 Flash (Attempt ${retryCount + 1})`);

    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dosiq.ai",
        "X-Title": "dosiqAi",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${fileType};base64,${base64Image}` }
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: MAX_TOKENS_REPORT,
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
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff
        await new Promise(r => setTimeout(r, delay));
        return callOpenRouterAPI(base64Image, fileType, prompt, retryCount + 1);
      }
      throw new Error(`OpenRouter API failed: ${response.status}`);
    }

    return await response.json();
  } catch (err: unknown) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(`[OpenRouter] 🔄 Network error, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return callOpenRouterAPI(base64Image, fileType, prompt, retryCount + 1);
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

/**
 * Generate presigned URL from R2 file key
 * Creates a temporary download URL valid for 1 hour
 */
function _getPresignedUrlFromR2(fileKey: string): string {
  try {
    console.log(`[R2] Generating presigned URL for key: ${fileKey}`);

    if (!R2_ENDPOINT || !R2_BUCKET_NAME) {
      throw new Error("R2 configuration is incomplete");
    }

    // For R2, we can construct a simple presigned URL
    // Format: https://<endpoint>/<bucket>/<key>?X-Amz-Algorithm=...
    // Simpler approach: Use the public R2 URL if available, or generate AWS-compatible presigned URL

    // Since we're using R2 with the AWS S3 SDK on the client side,
    // we'll use a similar approach here with native fetch
    const url = `${R2_ENDPOINT}/${fileKey}`;

    console.log(`[R2] ✅  Using R2 URL: ${url}`);
    return url;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[R2] ❌ Failed to generate presigned URL:", msg);
    throw new Error(`R2 presigned URL generation failed: ${msg}`);
  }
}

/**
 * Download file from a presigned URL and convert to base64
 * Uses chunked processing to avoid Maximum call stack size exceeded errors
 */
async function downloadFromPresignedUrl(presignedUrl: string): Promise<string> {
  try {
    console.log(`[PresignedURL] 🚀 Downloading from presigned URL... (v2.2-chunked)`);

    // Validate URL format roughly
    if (!presignedUrl || !presignedUrl.startsWith('http')) {
      throw new Error(`Invalid presigned URL format: ${presignedUrl?.substring(0, 20)}...`);
    }

    const startTime = Date.now();
    const response = await fetch(presignedUrl);

    console.log(`[PresignedURL] 📡 Response: ${response.status} ${response.statusText}`);
    console.log(`[PresignedURL] 📋 Headers:`, { ct: response.headers.get('content-type'), cl: response.headers.get('content-length') });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[PresignedURL] ❌ Status ${response.status}: ${errorBody.substring(0, 500)}`);
      throw new Error(`Presigned URL download failed with status ${response.status}: ${errorBody.substring(0, 200)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    const downloadTime = Date.now() - startTime;

    console.log(`[PresignedURL] ✅ File downloaded: ${(fileSize / 1024).toFixed(2)} KB in ${downloadTime}ms`);

    if (fileSize === 0) throw new Error('Downloaded file is empty (0 bytes)');

    const uint8Array = new Uint8Array(arrayBuffer);

    // CHUNKED CONVERSION to avoid "Maximum call stack size exceeded"
    // Apply limit is usually ~65536 arguments
    const CHUNK_SIZE = 0x8000; // 32768
    const chunks: string[] = [];

    for (let i = 0; i < fileSize; i += CHUNK_SIZE) {
      const chunk = uint8Array.subarray(i, i + CHUNK_SIZE);
      chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
    }

    const binaryString = chunks.join("");
    const base64 = btoa(binaryString);

    console.log(`[PresignedURL] ✅ Converted to base64: ${(base64.length / 1024).toFixed(2)} KB`);
    return base64;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[PresignedURL] ❌ Download failed:", msg);
    if (stack) console.error("[PresignedURL] 💥 Stack:", stack);

    // Re-throw with clear message
    throw new Error(`Failed to download file from presigned URL: ${msg}`);
  }
}
/**
 * Download file from R2 and convert to base64
 */
async function downloadFileAsBase64(fileKey: string): Promise<string> {
  try {
    console.log(`[R2] 🚀 Downloading file: ${fileKey}`);
    console.log('[R2] 📋 Config:', { hasEndpoint: !!R2_ENDPOINT, hasBucket: !!R2_BUCKET_NAME, hasAccessKey: !!R2_ACCESS_KEY_ID });

    if (!R2_ENDPOINT || !R2_BUCKET_NAME) {
      throw new Error("R2 configuration is incomplete");
    }

    const startTime = Date.now();

    // Construct R2 URL - including bucket name for S3-compatible API
    const fileUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${fileKey}`;

    console.log(`[R2] 📍 Fetching from: ${fileUrl}`);
    const response = await fetch(fileUrl);

    console.log(`[R2] 📡 Response: ${response.status} ${response.statusText}`);
    console.log(`[R2] 📋 Headers:`, { ct: response.headers.get('content-type'), cl: response.headers.get('content-length') });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[R2] ❌ Status ${response.status}: ${errorBody.substring(0, 500)}`);
      throw new Error(`R2 download failed: ${response.status} ${response.statusText} - ${errorBody.substring(0, 200)}`);
    }

    // Get file as array buffer
    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    const downloadTime = Date.now() - startTime;

    console.log(`[R2] ✅ File downloaded: ${(fileSize / 1024).toFixed(2)} KB in ${downloadTime}ms`);

    // Convert to base64 using chunking to avoid stack overflow
    const uint8Array = new Uint8Array(arrayBuffer);
    const CHUNK_SIZE = 0x8000; // 32KB
    const chunks: string[] = [];

    for (let i = 0; i < fileSize; i += CHUNK_SIZE) {
      const chunk = uint8Array.subarray(i, i + CHUNK_SIZE);
      chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
    }

    const binaryString = chunks.join("");
    const base64 = btoa(binaryString);

    console.log(`[R2] ✅ Converted to base64: ${(base64.length / 1024).toFixed(2)} KB`);
    return base64;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[R2] ❌ Failed to download file:", msg);
    if (stack) console.error("[R2] 💥 Stack:", stack);
    throw new Error(`R2 file download failed: ${msg}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  let documentId: string | null = null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Auth & Payload
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization");

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const body = await req.json();
    documentId = body.documentId;
    const { base64Image, cloudFileKey, presignedUrl, fileType } = body;

    console.log(`[Start] 📄 Document: ${documentId} | User: ${user.id}`);

    if (!documentId) throw new Error("Missing documentId");

    // Determine source: Presigned URL (new), R2 with key (legacy), or direct base64
    let finalBase64Image: string;

    if (presignedUrl) {
      // NEWEST PATH: Download from presigned URL (authenticated, no credentials needed)
      console.log(`[PresignedURL] 🔗 Using presigned URL: ${presignedUrl.substring(0, 100)}...`);
      finalBase64Image = await downloadFromPresignedUrl(presignedUrl);
    } else if (cloudFileKey) {
      // LEGACY R2 PATH: Download from R2 using cloudFileKey (requires credentials)
      console.log(`[R2] Using cloud file key: ${cloudFileKey}`);
      finalBase64Image = await downloadFileAsBase64(cloudFileKey);
    } else if (base64Image) {
      // OLDEST PATH: Use base64 directly (backward compatibility)
      console.log(`[Legacy] Using direct base64 (size: ${base64Image.length} chars)`);
      finalBase64Image = base64Image;
    } else {
      throw new Error("Missing presignedUrl, cloudFileKey, or base64Image");
    }

    // 2. AI Analysis
    const openRouterResponse = await callOpenRouterAPI(finalBase64Image, fileType, REPORT_PROMPT || body.prompt);
    const content = openRouterResponse.choices[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");

    const analysisResult = parseJSON(content);

    // 3. Save Analysis Status to Documents Table
    const { error: dbErr } = await supabase
      .from("documents")
      .update({
        ai_analysis_status: "completed",
        ai_analysis_result: analysisResult,
        ai_analyzed_at: new Date().toISOString(),
        ai_analysis_tokens_used: openRouterResponse.usage.total_tokens,
      })
      .eq("id", documentId);

    if (dbErr) throw dbErr;

    // 4. Create Lab Report Record
    console.log(`[Database] 🏥 Creating lab report for document: ${documentId}`);
    console.log('[AI Response] Full analysis result:', JSON.stringify(analysisResult, null, 2));

    // Helper function to find field in nested objects
    const findField = (obj: Record<string, unknown>, ...keys: string[]): unknown => {
      for (const key of keys) {
        if (obj[key] != null) return obj[key];

        // Check in common nested objects from AI response
        const patientInfo = obj.patient_info as Record<string, unknown> | undefined;
        const reportMeta = obj.report_meta as Record<string, unknown> | undefined;
        const commonData = obj.common_data as Record<string, unknown> | undefined;
        const reportInfo = obj.report_info as Record<string, unknown> | undefined;

        if (patientInfo?.[key] != null) return patientInfo[key];
        if (reportMeta?.[key] != null) return reportMeta[key];
        if (commonData?.[key] != null) return commonData[key];
        if (reportInfo?.[key] != null) return reportInfo[key];
      }
      return null;
    };

    // Extract metadata from analysis result (with comprehensive fallbacks)
    const reportData = {
      user_id: user.id,
      document_id: documentId,
      patient_name: findField(analysisResult, 'patient_name', 'name', 'patientName'),
      age: (() => {
        const ageVal = findField(analysisResult, 'age', 'patient_age', 'patientAge');
        if (typeof ageVal === 'number') return ageVal;
        if (typeof ageVal === 'string') {
          // Handle "29 Y", "29 years", etc.
          const match = ageVal.match(/(\d+)/);
          return match ? parseInt(match[1]) : null;
        }
        return null;
      })(),
      gender: findField(analysisResult, 'gender', 'sex', 'patient_gender'),
      lab_name: findField(analysisResult, 'lab_name', 'laboratory', 'lab', 'labName'),
      collection_date: findField(analysisResult, 'collection_date', 'sample_date', 'collectionDate', 'sampleDate'),
      report_date: findField(analysisResult, 'report_date', 'date', 'test_date', 'reportDate', 'testDate'),
      ai_summary: findField(analysisResult, 'ai_summary', 'summary', 'interpretation', 'clinical_summary', 'aiSummary', 'clinicalSummary'),
    };


    console.log('[Database] 📋 Extracted report data:', JSON.stringify({
      patient_name: reportData.patient_name,
      age: reportData.age,
      gender: reportData.gender,
      lab_name: reportData.lab_name,
      report_date: reportData.report_date,
    }, null, 2));

    const { data: labReport, error: labErr } = await supabase
      .from("lab_reports")
      .insert(reportData)
      .select()
      .single();

    if (labErr) {
      console.error("[Database] ❌ Failed to create lab report:", labErr);
      console.error("[Database] 📊 Report data that failed:", JSON.stringify(reportData, null, 2));
      // We don't throw here to avoid failing the whole process if metadata insert fails
    } else {
      console.log(`[Database] ✅ Successfully created lab report with ID: ${labReport?.id}`);
    }

    // 5. Create Test Results Records
    if (labReport && Array.isArray(analysisResult.tests) && analysisResult.tests.length > 0) {
      console.log(`[Database] 🧪 Inserting ${analysisResult.tests.length} test results`);

      const testResults = analysisResult.tests.map((test: Record<string, unknown>) => {
        const mappedTest = {
          user_id: user.id,
          lab_report_id: labReport.id,
          report_date: reportData.report_date,
          test_name: test.test_name || test.name || "Unknown Test",
          value: test.value ?? null,
          unit: test.unit ?? null,
          ref_min: test.ref_min != null ? parseFloat(String(test.ref_min)) : null,
          ref_max: test.ref_max != null ? parseFloat(String(test.ref_max)) : null,
          ref_type: test.ref_type || null,
          status: test.status || null,
        };

        console.log(`[Database] Test mapped: ${mappedTest.test_name} | report_date: ${mappedTest.report_date}`);
        return mappedTest;
      });

      const { data: insertedTests, error: testsErr } = await supabase
        .from("test_results")
        .insert(testResults)
        .select('id, test_name, value, unit, status, ref_min, ref_max, ref_type');

      if (testsErr) {
        console.error("[Database] ❌ Failed to insert test results:", testsErr);
      } else {
        console.log(`[Database] ✅ Successfully inserted ${testResults.length} test results`);

        // 6. Trigger match-biomarkers function (Fire-and-Forget)
        if (insertedTests && insertedTests.length > 0) {
          console.log(`[Trigger] 🔫 Invoking match-biomarkers with ${insertedTests.length} tests (Async)`);

          const matchFunctionUrl = `${SUPABASE_URL}/functions/v1/match-biomarkers`;

          // Define the async trigger function
          const triggerMatcher = async () => {
            try {
              const startMatch = Date.now();
              console.log(`[Trigger] 🚀 Sending request to: ${matchFunctionUrl}`);

              const matchRes = await fetch(matchFunctionUrl, {
                method: "POST",
                headers: {
                  "Authorization": authHeader, // Forwarding USER JWT to fix 401 error
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ tests: insertedTests }),
              });

              const matchDuration = Date.now() - startMatch;
              console.log(`[Trigger] 📡 Match-biomarkers response: ${matchRes.status} (${matchDuration}ms)`);

              if (!matchRes.ok) {
                const errText = await matchRes.text();
                console.error(`[Trigger] ❌ Match function error body: ${errText.substring(0, 200)}`);
              }
            } catch (err) {
              console.error(`[Trigger] ❌ Failed to invoke match-biomarkers: ${err}`);
            }
          };

          // Use EdgeRuntime.waitUntil to keep the function alive after returning response
          // @ts-ignore: EdgeRuntime is available in Supabase environment
          if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
            console.log(`[Trigger] ⏳ Scheduling background task via EdgeRuntime.waitUntil`);
            // @ts-ignore: EdgeRuntime is available in Supabase environment
            EdgeRuntime.waitUntil(triggerMatcher());
          } else {
            console.warn(`[Trigger] ⚠️ EdgeRuntime.waitUntil not found, executing promise without await (may be flaky locally)`);
            triggerMatcher();
          }
        }
      }
    }

    // Enrichment removed per requirements

    return new Response(JSON.stringify({
      success: true,
      duration: Date.now() - startTime,
      tokens: openRouterResponse.usage.total_tokens,
      analysisResult
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Fatal] ❌", msg);

    if (documentId) {
      await supabase.from("documents").update({
        ai_analysis_status: "failed",
        ai_analysis_error: { message: msg, time: new Date().toISOString() }
      }).eq("id", documentId);
    }

    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
