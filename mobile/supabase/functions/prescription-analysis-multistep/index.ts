/// <reference no-default-lib="true" />
/// <reference lib="esnext" />

/**
 * Supabase Edge Function: prescription-analysis-multistep
 *
 * Analyzes uploaded prescription documents using OpenRouter API (Google Gemini 3 Flash Preview)
 * using a multi-step pathway based on whether the document is handwritten or machine-written.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// @ts-ignore: Deno allows .ts extensions in imports
import { PROMPT_CHECK_HANDWRITTEN } from "./prompt_check_handwritten.ts";
// @ts-ignore
import { PROMPT_HANDWRITTEN_ANALYSIS } from "./prompt_handwritten_analysis.ts";
// @ts-ignore
import { PROMPT_HANDWRITTEN_VERIFICATION } from "./prompt_handwritten_verification.ts";
// @ts-ignore
import { PROMPT_MACHINE_ANALYSIS } from "./prompt_machine_analysis.ts";

declare const Deno: any;

// Environment variables
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// R2 Configuration
const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "";

// OpenRouter configuration
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const MAX_FILE_SIZE_MB = 10;
const MAX_BASE64_LENGTH = (MAX_FILE_SIZE_MB * 1024 * 1024 * 4) / 3;

const MAX_TOKENS_PRESCRIPTION = 15000;

const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/heic",
    "image/heif",
    "application/pdf",
];

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

interface ApiOptions {
    useReasoning?: boolean;
    maxTokens?: number;
    temperature?: number;
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
            return true; // Fail open
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
    messages: any[],
    options: ApiOptions = {},
    retryCount: number = 0
): Promise<OpenRouterResponse> {
    try {
        const stepName = options.useReasoning ? "Reasoning" : "Standard";
        console.log(`[OpenRouter] Calling Gemini 3 Flash ${stepName} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

        const requestBody: any = {
            model: MODEL,
            messages: messages,
            temperature: options.temperature ?? 1.0,
            max_tokens: options.maxTokens ?? MAX_TOKENS_PRESCRIPTION,
            response_format: { type: "json_object" },
        };

        if (options.useReasoning) {
            requestBody.reasoning = {
                enabled: true,
                effort: "medium",
            };
        } else {
            // Disable extended reasoning for fast classification steps
            requestBody.reasoning = {
                enabled: false
            };
        }

        const response = await fetch(OPENROUTER_ENDPOINT, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://familycarehealth.app",
                "X-Title": "FamilyCare Health",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[OpenRouter] API error (${response.status}):`, errorText);

            // Retry on rate limit or temporary errors
            if ([429, 500, 502, 503].includes(response.status) && retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAY_MS * (retryCount + 1);
                console.log(`[OpenRouter] Retrying in ${delay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                return callOpenRouterAPI(messages, options, retryCount + 1);
            }

            throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        console.log("[OpenRouter] API call successful");
        return data as OpenRouterResponse;
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAY_MS * (retryCount + 1);
            console.log(`[OpenRouter] Network error, retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return callOpenRouterAPI(messages, options, retryCount + 1);
        }
        throw error;
    }
}

function parseAnalysisResult(analysisText: string): Record<string, unknown> {
    try {
        const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonText = jsonMatch ? jsonMatch[1] : analysisText;

        const parsed = JSON.parse(jsonText.trim());
        console.log('[Parser] ✅ Successfully parsed JSON response');
        return parsed;
    } catch (parseError) {
        console.error("[Parser] ❌ Failed to parse JSON");
        console.error("[Parser] Error details:", parseError instanceof Error ? parseError.message : String(parseError));
        console.error("[Parser] First 500 chars of response:", analysisText.substring(0, 500));

        return {
            rawText: analysisText,
            parseError: "Could not parse as JSON",
            summary: analysisText.substring(0, 500),
        };
    }
}

async function downloadFileAsBase64(fileKey: string): Promise<string> {
    try {
        console.log(`[R2] Downloading file: ${fileKey}`);
        if (!R2_ENDPOINT || !R2_BUCKET_NAME) {
            throw new Error("R2 configuration is incomplete");
        }

        const startTime = Date.now();
        const fileUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${fileKey}`;

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

        return base64;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
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
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    let documentId: string | undefined;
    let supabase: SupabaseClient | undefined;
    let totalTokenUsage = 0;

    try {
        if (!OPENROUTER_API_KEY) {
            throw new Error("Analysis service not configured");
        }

        supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Missing authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const body = await req.json();
        const { cloudFileKey, prompt } = body;
        let { base64Image, fileType } = body;
        documentId = body.documentId;

        if (!documentId) {
            return new Response(JSON.stringify({ error: "Missing documentId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (cloudFileKey) {
            base64Image = await downloadFileAsBase64(cloudFileKey);
            if (!fileType) {
                const ext = cloudFileKey.split('.').pop()?.toLowerCase();
                fileType = ext === 'pdf' ? 'application/pdf' : `image/${ext}`;
            }
        } else if (!base64Image) {
            return new Response(JSON.stringify({ error: "Missing cloudFileKey and base64Image" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (!ALLOWED_MIME_TYPES.includes(fileType)) {
            return new Response(
                JSON.stringify({ error: `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}` }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (base64Image.length > MAX_BASE64_LENGTH) {
            return new Response(JSON.stringify({ error: "File too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const allowed = await checkRateLimit(supabase, user.id);
        if (!allowed) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded", code: "RATE_LIMIT_EXCEEDED" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { data: document, error: docError } = await supabase
            .from("documents")
            .select("id, user_id")
            .eq("id", documentId)
            .single();

        if (docError || !document || document.user_id !== user.id) {
            return new Response(JSON.stringify({ error: "Not found or unauthorized" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await supabase.from("documents").update({ ai_analysis_status: "processing" }).eq("id", documentId);

        // STEP 1: Classification (Is Handwritten?)
        // Using standard Flash (fast, non-reasoning)
        console.log("[Multistep] Step 1: Classifying handwriting...");
        const classificationMessages = [
            { role: "system", content: PROMPT_CHECK_HANDWRITTEN },
            {
                role: "user", content: [
                    { type: "image_url", image_url: { url: `data:${fileType};base64,${base64Image}` } },
                    { type: "text", text: "Please return the JSON indicating if this is handwritten." }
                ]
            }
        ];

        const classificationRes = await callOpenRouterAPI(classificationMessages, { useReasoning: false, maxTokens: 500, temperature: 0.1 });
        totalTokenUsage += classificationRes.usage.total_tokens;

        const classResult = parseAnalysisResult(classificationRes.choices[0]?.message?.content || "{}");
        const isHandwritten = classResult.is_handwritten === true;
        console.log(`[Multistep] Classification result: Handwritten = ${isHandwritten} (Confidence: ${classResult.confidence})`);

        let finalAnalysisResult: any = null;
        let stage1AnalysisResult: any = null;

        if (isHandwritten) {
            // STEP 2: Handwritten Pipeline
            console.log("[Multistep] Step 2: Extracting Handwritten Data...");
            const extractionMessages = [
                { role: "system", content: PROMPT_HANDWRITTEN_ANALYSIS },
                {
                    role: "user", content: [
                        { type: "image_url", image_url: { url: `data:${fileType};base64,${base64Image}` } },
                        { type: "text", text: "Extract structured data from this handwritten prescription image." }
                    ]
                }
            ];

            const extractionRes = await callOpenRouterAPI(extractionMessages, { useReasoning: true, temperature: 0.82 });
            totalTokenUsage += extractionRes.usage.total_tokens;
            const extractedData = parseAnalysisResult(extractionRes.choices[0]?.message?.content || "{}");
            stage1AnalysisResult = extractedData;

            console.log("[Multistep] Step 3: Verifying Handwritten Data...");
            const verificationMessages = [
                { role: "system", content: PROMPT_HANDWRITTEN_VERIFICATION },
                {
                    role: "user", content: [
                        { type: "image_url", image_url: { url: `data:${fileType};base64,${base64Image}` } },
                        { type: "text", text: `Here is the initially extracted JSON. Verify, correct, and add missing data:\n\n${JSON.stringify(extractedData)}` }
                    ]
                }
            ];

            const verificationRes = await callOpenRouterAPI(verificationMessages, { useReasoning: true, temperature: 0.82 });
            totalTokenUsage += verificationRes.usage.total_tokens;
            finalAnalysisResult = parseAnalysisResult(verificationRes.choices[0]?.message?.content || "{}");

        } else {
            // STEP 2: Machine-written Pipeline
            console.log("[Multistep] Step 2: Extracting Machine-Written Data...");
            const machineMessages = [
                { role: "system", content: PROMPT_MACHINE_ANALYSIS },
                {
                    role: "user", content: [
                        { type: "image_url", image_url: { url: `data:${fileType};base64,${base64Image}` } },
                        { type: "text", text: "Extract structured data from this machine-written prescription image." }
                    ]
                }
            ];

            const machineRes = await callOpenRouterAPI(machineMessages, { useReasoning: true, temperature: 0.82 });
            totalTokenUsage += machineRes.usage.total_tokens;
            finalAnalysisResult = parseAnalysisResult(machineRes.choices[0]?.message?.content || "{}");
        }

        const patientName = finalAnalysisResult.patient?.name || null;
        const diagnosis = finalAnalysisResult.diagnosis?.condition || null;
        const visitDate = finalAnalysisResult.visit_date || null;
        const issuedBy = finalAnalysisResult.doctor?.name || null;

        let followUpDate = null;
        const followUpDays = finalAnalysisResult.follow_up_days;

        if (visitDate && followUpDays && !isNaN(parseInt(String(followUpDays)))) {
            try {
                const date = new Date(String(visitDate));
                date.setDate(date.getDate() + parseInt(String(followUpDays)));
                followUpDate = date.toISOString().split('T')[0];
            } catch (e) {
                console.error("[DateCalc] Failed to calculate follow_up_date:", e);
            }
        }

        const duration = Date.now() - startTime;
        console.log(`[Success] Multi-step analysis completed in ${duration}ms, total tokens: ${totalTokenUsage}`);

        const { error: finalUpdateError } = await supabase
            .from("documents")
            .update({
                ai_analysis_status: "completed",
                ai_analysis_result: finalAnalysisResult,
                ...(stage1AnalysisResult && { ai_analysis_stage1: stage1AnalysisResult }),
                ai_analyzed_at: new Date().toISOString(),
                ai_analysis_tokens_used: totalTokenUsage,
                ai_analysis_error: null,
                patient_name: patientName,
                diagnosis: diagnosis,
                visit_date: visitDate,
                follow_up_date: followUpDate,
                issued_by: issuedBy,
            })
            .eq("id", documentId);

        if (finalUpdateError) {
            throw new Error(`Failed to save analysis results: ${finalUpdateError.message}`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                documentId,
                analysis: finalAnalysisResult,
                tokensUsed: totalTokenUsage,
                duration,
                pathway: isHandwritten ? "handwritten_multistep" : "machine_singlestep"
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        console.error("[Error] Prescription analysis failed:", error);

        try {
            if (documentId && supabase) {
                await supabase
                    .from("documents")
                    .update({
                        ai_analysis_status: "failed",
                        ai_analysis_error: { error: errorMessage, timestamp: new Date().toISOString() },
                    })
                    .eq("id", documentId);
            }
        } catch (updateError) {
            console.error("[Error] Failed to update document status:", updateError);
        }

        return new Response(
            JSON.stringify({ success: false, error: errorMessage, duration: Date.now() - startTime }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
