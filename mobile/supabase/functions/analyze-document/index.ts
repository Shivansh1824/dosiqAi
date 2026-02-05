/**
 * Supabase Edge Function: analyze-document
 *
 * Analyzes uploaded health documents using OpenRouter API (Google Gemini 3 Flash Preview)
 * This function acts as a secure proxy to keep the OpenRouter API key on the server
 *
 * Configuration (Edge Function Secrets):
 * - OPENROUTER_API_KEY: OpenRouter API key for authentication
 * - DOCUMENT_ANALYSIS_PROMPT: Default prompt for document analysis (required)
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

import { serve } from "std/http/server.ts";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Environment variables (automatically available in Edge Functions)
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DOCUMENT_ANALYSIS_PROMPT = Deno.env.get("DOCUMENT_ANALYSIS_PROMPT") || "";

// OpenRouter configuration
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const MAX_FILE_SIZE_MB = 10;
const MAX_BASE64_LENGTH = (MAX_FILE_SIZE_MB * 1024 * 1024 * 4) / 3; // Account for base64 encoding

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
interface AnalyzeDocumentRequest {
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
  prompt: string,
  retryCount: number = 0
): Promise<OpenRouterResponse> {
  try {
    console.log(`[OpenRouter] Calling API (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

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
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${fileType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 2000,
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
        return callOpenRouterAPI(base64Image, fileType, prompt, retryCount + 1);
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
      return callOpenRouterAPI(base64Image, fileType, prompt, retryCount + 1);
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
    const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : analysisText;

    return JSON.parse(jsonText.trim());
  } catch (_parseError) {
    // If parsing fails, store as raw text with error
    console.warn("[Parser] Could not parse JSON, storing as raw text");
    return {
      rawText: analysisText,
      parseError: "Could not parse as JSON",
      summary: analysisText.substring(0, 500), // First 500 chars as summary
    };
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
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();

  try {
    // Validate OpenRouter API key
    if (!OPENROUTER_API_KEY) {
      console.error("[Config] OPENROUTER_API_KEY not configured");
      throw new Error("Analysis service not configured");
    }

    // Validate Document Analysis Prompt
    if (!DOCUMENT_ANALYSIS_PROMPT) {
      console.error("[Config] DOCUMENT_ANALYSIS_PROMPT not configured");
      throw new Error("Document analysis prompt not configured");
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    const body: AnalyzeDocumentRequest = await req.json();
    const { documentId, base64Image, fileType, prompt } = body;

    // Validate required fields
    if (!documentId || !base64Image || !fileType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: documentId, base64Image, fileType" }),
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
      .select("id, user_id")
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

    // Call OpenRouter API
    const analysisPrompt = prompt || DOCUMENT_ANALYSIS_PROMPT;
    const openRouterResponse = await callOpenRouterAPI(base64Image, fileType, analysisPrompt);

    // Extract analysis result
    const analysisText = openRouterResponse.choices[0]?.message?.content;
    if (!analysisText || analysisText.trim().length === 0) {
      throw new Error("Empty response from OpenRouter API");
    }

    // Parse JSON from response
    const analysisResult = parseAnalysisResult(analysisText);

    // Calculate duration
    const duration = Date.now() - startTime;

    console.log(`[Success] Analysis completed in ${duration}ms, tokens: ${openRouterResponse.usage.total_tokens}`);

    // Update document with analysis result
    const { error: finalUpdateError } = await supabase
      .from("documents")
      .update({
        ai_analysis_status: "completed",
        ai_analysis_result: analysisResult,
        ai_analyzed_at: new Date().toISOString(),
        ai_analysis_tokens_used: openRouterResponse.usage.total_tokens,
        ai_analysis_error: null,
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
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[Error] Analysis failed:", error);

    const duration = Date.now() - startTime;

    // Try to update document status to 'failed'
    // Save the prompt that was used so we know what caused the failure
    try {
      if (documentId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        // Save error as JSON with prompt
        const errorData = {
          error: errorMessage,
          prompt: DOCUMENT_ANALYSIS_PROMPT // Use default prompt if custom one not available in this scope easily
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
