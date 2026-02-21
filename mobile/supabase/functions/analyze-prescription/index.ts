/// <reference no-default-lib="true" />
/// <reference lib="esnext" />

/**
 * Supabase Edge Function: analyze-prescription
 *
 * Analyzes uploaded prescription documents using OpenRouter API (Google Gemini 3 Flash Preview)
 * This function acts as a secure proxy to keep the OpenRouter API key on the server
 *
 * Configuration (Edge Function Secrets):
 * - OPENROUTER_API_KEY: OpenRouter API key for authentication
 * - DOCUMENT_ANALYSIS_PROMPT: Prompt for prescription analysis (required)
 *
 * Request Payload:
 * {
 *   "documentId": "uuid-of-document"
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   documentId: string;
 *   analysis?: object;
 *   tokensUsed?: number;
 *   duration?: number;
 *   error?: string;
 *   code?: string;
 * }
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
// @ts-ignore: Deno allows .ts extensions in imports
import { DOCUMENT_ANALYSIS_PROMPT } from "./prompt_prescription_analysis.ts";

declare const Deno: any;

// Environment variables (automatically available in Edge Functions)
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
// const DOCUMENT_ANALYSIS_PROMPT = Deno.env.get("DOCUMENT_ANALYSIS_PROMPT") || "";

// R2 Configuration (for downloading files from Cloudflare R2)
const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "";

// OpenRouter configuration
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const MAX_FILE_SIZE_MB = 10;
const MAX_BASE64_LENGTH = (MAX_FILE_SIZE_MB * 1024 * 1024 * 4) / 3; // Account for base64 encoding

// Token limits for prescriptions (simpler, shorter documents)
const MAX_TOKENS_PRESCRIPTION = 15000;

// Allowed file types
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
];

// Request/Response interfaces
interface AnalyzePrescriptionRequest {
  documentId: string;
  base64Image: string;
  fileType: string;
  prompt?: string;
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

/**
 * Check if user has exceeded upload limit
 */
async function checkRateLimit(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_upload_limit", {
      p_user_id: userId,
      p_max_uploads: 5,
    });

    if (error) {
      console.error("[RateLimit] Error checking limit:", error);
      return true; // Fail open - allow request if check fails
    }

    return data === true;
  } catch (error) {
    console.error("[RateLimit] Exception:", error);
    return true; // Fail open
  }
}

/**
 * Call OpenRouter API with retry logic
 */
async function callOpenRouterAPI(
  base64Image: string,
  fileType: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  retryCount: number = 0
): Promise<OpenRouterResponse> {
  try {
    console.log(`[OpenRouter] Calling Gemini 3 Flash (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://familycarehealth.app",
        "X-Title": "FamilyCare Health",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            // System prompt: static rules, schema, and persona — eligible for prompt caching
            role: "system",
            content: systemPrompt,
          },
          {
            // User prompt: image FIRST (Gemini 3 anchors reasoning better with data before instructions)
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${fileType};base64,${base64Image}`,
                },
              },
              {
                type: "text",
                text: userPrompt,
              },
            ],
          },
        ],
        temperature: 0.85, // Gemini 3 Flash: Google recommends default 1.0 — reasoning degrades at lower values
        max_tokens: maxTokens,
        response_format: { type: "json_object" }, // Request raw JSON without markdown
        reasoning: {
          enabled: true,
          effort: "medium",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenRouter] API error (${response.status}):`, errorText);

      // Retry on rate limit or temporary errors
      if ([429, 500, 502, 503].includes(response.status) && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * (retryCount + 1);
        console.log(`[OpenRouter] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return callOpenRouterAPI(base64Image, fileType, systemPrompt, userPrompt, maxTokens, retryCount + 1);
      }

      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("[OpenRouter] API call successful");
    return data as OpenRouterResponse;
  } catch (error) {
    // Retry on network errors
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * (retryCount + 1);
      console.log(`[OpenRouter] Network error, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callOpenRouterAPI(base64Image, fileType, systemPrompt, userPrompt, maxTokens, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Parse JSON from OpenRouter response
 * Handles both raw JSON and JSON wrapped in markdown code blocks
 */
function parseAnalysisResult(analysisText: string): Record<string, unknown> {
  try {
    // Try to extract JSON from markdown code blocks
    // More flexible regex that handles various newline styles and whitespace
    const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : analysisText;

    const parsed = JSON.parse(jsonText.trim());
    console.log('[Parser] ✅ Successfully parsed JSON response');
    return parsed;
  } catch (parseError) {
    // If parsing fails, store as raw text with error
    console.error("[Parser] ❌ Failed to parse JSON");
    console.error("[Parser] Error details:", parseError instanceof Error ? parseError.message : String(parseError));
    console.error("[Parser] First 500 chars of response:", analysisText.substring(0, 500));

    return {
      rawText: analysisText,
      parseError: "Could not parse as JSON",
      summary: analysisText.substring(0, 500), // First 500 chars as summary
    };
  }
}

/**
 * Download file from R2 and convert to base64
 */
async function downloadFileAsBase64(fileKey: string): Promise<string> {
  try {
    console.log(`[R2] Downloading file: ${fileKey}`);

    if (!R2_ENDPOINT || !R2_BUCKET_NAME) {
      throw new Error("R2 configuration is incomplete");
    }

    const startTime = Date.now();
    // Construct R2 URL - including bucket name for S3-compatible API
    const fileUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${fileKey}`;

    console.log(`[R2] Fetching from: ${fileUrl}`);
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`R2 download failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    const downloadTime = Date.now() - startTime;

    console.log(`[R2] ✅ File downloaded: ${(fileSize / 1024).toFixed(2)} KB in ${downloadTime}ms`);

    const uint8Array = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode(...uint8Array));

    console.log(`[R2] ✅ Converted to base64: ${(base64.length / 1024).toFixed(2)} KB`);
    return base64;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[R2] ❌ Failed to download file:", msg);
    throw new Error(`R2 file download failed: ${msg}`);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

/**
 * Main handler
 */
Deno.serve(async (req: Request) => {
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
    // Validate OpenRouter API key
    if (!OPENROUTER_API_KEY) {
      console.error("[Config] OPENROUTER_API_KEY not configured");
      throw new Error("Analysis service not configured");
    }

    // Initialize Supabase client with service role key
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate user from JWT token
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

    console.log(`[Request] User: ${user.id}`);

    // Parse request body
    const body = await req.json();
    const { cloudFileKey, prompt } = body;
    let { base64Image, fileType } = body;
    documentId = body.documentId;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[DEBUG] 📤 PRESCRIPTION ANALYSIS REQUEST');
    console.log(`[DEBUG] Document ID: ${documentId}`);
    console.log(`[DEBUG] Cloud file key: ${cloudFileKey || 'NOT PROVIDED'}`);
    console.log(`[DEBUG] Custom prompt provided: ${prompt ? 'YES' : 'NO'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Validate document ID
    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: documentId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine source: R2 or direct base64
    if (cloudFileKey) {
      // NEW PATH: Download from R2
      console.log(`[R2] Using cloud file key: ${cloudFileKey}`);
      base64Image = await downloadFileAsBase64(cloudFileKey);
      // Infer fileType from filename if not provided
      if (!fileType) {
        const ext = cloudFileKey.split('.').pop()?.toLowerCase();
        fileType = ext === 'pdf' ? 'application/pdf' : `image/${ext}`;
      }
    } else if (!base64Image) {
      return new Response(
        JSON.stringify({ error: "Missing both cloudFileKey and base64Image" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // OLD PATH: Use base64 directly
      console.log(`[Legacy] Using direct base64 (size: ${base64Image.length} chars)`);
    }

    // Validate fileType is set
    if (!fileType) {
      return new Response(
        JSON.stringify({ error: "Missing required field: fileType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      return new Response(
        JSON.stringify({
          error: `Unsupported file type: ${fileType}. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (base64 length check)
    if (base64Image.length > MAX_BASE64_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `File too large (max ${MAX_FILE_SIZE_MB} MB)`
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Request] Document: ${documentId}, Type: ${fileType}, Size: ${(base64Image.length * 0.75 / 1024).toFixed(2)} KB`);

    // Check rate limiting
    const allowed = await checkRateLimit(supabase, user.id);
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "Daily upload limit reached (5 documents per day)",
          code: "RATE_LIMIT_EXCEEDED",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify document exists and belongs to user
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, user_id, type")
      .eq("id", documentId)
      .single();

    if (docError || !document || document.user_id !== user.id) {
      console.error("[Auth] Document not found or unauthorized:", docError);
      return new Response(
        JSON.stringify({ error: "Document not found or unauthorized" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update document status to 'processing'
    const { error: processingError } = await supabase
      .from("documents")
      .update({
        ai_analysis_status: "processing",
      })
      .eq("id", documentId);

    if (processingError) {
      console.error("[Status] Failed to mark as processing:", processingError);
      // We continue anyway, but log it
    } else {
      console.log("[Status] Document marked as processing");
    }

    // System prompt: static rules/schema (cacheable)
    // User prompt: short task instruction sent alongside the image
    const systemPrompt = prompt || DOCUMENT_ANALYSIS_PROMPT;
    const userPrompt = "Analyze the attached prescription image and extract all information strictly following the rules. Return only valid JSON with no markdown wrapping.";

    // Safety check - ensure we have a system prompt
    if (!systemPrompt || systemPrompt.trim().length === 0) {
      console.error('[Config] ❌ No valid system prompt available!');
      throw new Error('Analysis prompt not configured properly');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[DEBUG] 🎯 PRESCRIPTION TOKEN LIMIT CONFIGURATION');
    console.log(`[DEBUG] Max Tokens: ${MAX_TOKENS_PRESCRIPTION}`);
    console.log('[DEBUG] Prompt architecture: system + user (split for caching)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const openRouterResponse = await callOpenRouterAPI(base64Image, fileType, systemPrompt, userPrompt, MAX_TOKENS_PRESCRIPTION);

    // Extract analysis result
    const analysisText = openRouterResponse.choices[0]?.message?.content;
    if (!analysisText || analysisText.trim().length === 0) {
      throw new Error("Empty response from OpenRouter API");
    }

    // Parse JSON from response
    const analysisResult = parseAnalysisResult(analysisText);

    // Extract top-level fields from AI analysis result using type assertions
    const patientInfo = analysisResult.patient_info as Record<string, unknown> | undefined;
    const prescriptionData = analysisResult.prescription_data as Record<string, unknown> | undefined;
    const commonData = analysisResult.common_data as Record<string, unknown> | undefined;

    const patientName = patientInfo?.name || null;
    const diagnosis = prescriptionData?.medical_issue_diagnosis || null;
    const visitDate = commonData?.visit_date || null;
    const issuedBy = prescriptionData?.doctor_name || null;

    // Calculate follow_up_date from visit_date + follow_up_days
    let followUpDate = null;
    const followUp = prescriptionData?.follow_up as Record<string, unknown> | undefined;
    const followUpDays = followUp?.follow_up_days || followUp?.follow_up_after_no_days || prescriptionData?.follow_up_after_no_days;

    if (visitDate && followUpDays && !isNaN(parseInt(String(followUpDays)))) {
      try {
        const date = new Date(String(visitDate));
        date.setDate(date.getDate() + parseInt(String(followUpDays)));
        followUpDate = date.toISOString().split('T')[0];
      } catch (e) {
        console.error("[DateCalc] Failed to calculate follow_up_date:", e);
      }
    } else {
      // Fallback: check if there's an explicit follow_up_date
      followUpDate = followUp?.follow_up_date || null;
    }

    console.log('[Fields] Extracted:', JSON.stringify({ patientName, diagnosis, visitDate, followUpDate, issuedBy }));

    // Calculate duration
    const duration = Date.now() - startTime;

    console.log(`[Success] Prescription analysis completed in ${duration}ms, tokens: ${openRouterResponse.usage.total_tokens}`);

    // Update document with analysis result AND extracted fields
    const { error: finalUpdateError } = await supabase
      .from("documents")
      .update({
        ai_analysis_status: "completed",
        ai_analysis_result: analysisResult,
        ai_analyzed_at: new Date().toISOString(),
        ai_analysis_tokens_used: openRouterResponse.usage.total_tokens,
        ai_analysis_error: null,
        patient_name: patientName,
        diagnosis: diagnosis,
        visit_date: visitDate,
        follow_up_date: followUpDate,
        issued_by: issuedBy,
      })
      .eq("id", documentId);

    if (finalUpdateError) {
      console.error("[Status] Failed to save final results:", finalUpdateError);
      throw new Error(`Failed to save analysis results: ${finalUpdateError.message}`);
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        analysis: analysisResult,
        tokensUsed: openRouterResponse.usage.total_tokens,
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
    console.error("[Error] Prescription analysis failed:", error);

    const duration = Date.now() - startTime;

    // Try to update document status to 'failed'
    try {
      if (documentId && supabase && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        console.log('[Error] Saving error state to database...');
        // Save error as JSON
        const errorData = {
          error: errorMessage,
          timestamp: new Date().toISOString()
        };

        await supabase
          .from("documents")
          .update({
            ai_analysis_status: "failed",
            ai_analysis_error: errorData,
          })
          .eq("id", documentId);
      }
    } catch (updateError) {
      console.error("[Error] Failed to update document status:", updateError);
    }

    // Return error response
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
