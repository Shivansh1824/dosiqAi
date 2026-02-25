import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// @ts-ignore
import { PROMPT_DOCUMENT_CLASSIFICATION } from "./prompt_document_classification.ts";

declare const Deno: any;

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

/**
 * Call OpenRouter API with retry logic
 */
async function callOpenRouterAPI(
    base64Image: string,
    fileType: string,
    retryCount: number = 0
): Promise<any> {
    try {
        console.log(`[OpenRouter] Calling Gemini 3 Flash Classification (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

        const requestBody: any = {
            model: MODEL,
            messages: [
                { role: "system", content: PROMPT_DOCUMENT_CLASSIFICATION },
                {
                    role: "user", content: [
                        { type: "image_url", image_url: { url: `data:${fileType};base64,${base64Image}` } },
                        { type: "text", text: "Please return the JSON classifying this document." }
                    ]
                }
            ],
            temperature: 0.1,
            max_tokens: 500,
            response_format: { type: "json_object" },
            reasoning: { enabled: false }, // Fast classification, no reasoning needed
        };

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

            if ([429, 500, 502, 503].includes(response.status) && retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAY_MS * (retryCount + 1);
                console.log(`[OpenRouter] Retrying in ${delay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                return callOpenRouterAPI(base64Image, fileType, retryCount + 1);
            }
            throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAY_MS * (retryCount + 1);
            console.log(`[OpenRouter] Network error, retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return callOpenRouterAPI(base64Image, fileType, retryCount + 1);
        }
        throw error;
    }
}

function parseAnalysisResult(analysisText: string): Record<string, unknown> {
    try {
        const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonText = jsonMatch ? jsonMatch[1] : analysisText;
        return JSON.parse(jsonText.trim());
    } catch (parseError) {
        console.error("[Parser] ❌ Failed to parse JSON");
        return { document_type: "invalid", is_handwritten: false, reasoning: "Parse Failed" };
    }
}

async function downloadFromPresignedUrl(presignedUrl: string): Promise<string> {
    const response = await fetch(presignedUrl);
    if (!response.ok) throw new Error("Failed to download from presigned URL: " + response.statusText);
    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    const uint8Array = new Uint8Array(arrayBuffer);
    const CHUNK_SIZE = 0x8000;
    const chunks: string[] = [];
    for (let i = 0; i < fileSize; i += CHUNK_SIZE) {
        const chunk = uint8Array.subarray(i, i + CHUNK_SIZE);
        chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
    }
    return btoa(chunks.join(""));
}

async function downloadFileAsBase64(fileKey: string): Promise<string> {
    const fileUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${fileKey}`;
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error("R2 download failed: " + response.statusText);
    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    const uint8Array = new Uint8Array(arrayBuffer);
    const CHUNK_SIZE = 0x8000;
    const chunks: string[] = [];
    for (let i = 0; i < fileSize; i += CHUNK_SIZE) {
        const chunk = uint8Array.subarray(i, i + CHUNK_SIZE);
        chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
    }
    return btoa(chunks.join(""));
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    let documentId: string | undefined;

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            throw new Error("Missing authorization header");
        }

        const body = await req.json();
        documentId = body.documentId;
        const { cloudFileKey, presignedUrl } = body;
        let { base64Image, fileType } = body;

        console.log(`[DocumentManager] Start processing document ${documentId}`);

        // Extract image base64
        if (presignedUrl) {
            base64Image = await downloadFromPresignedUrl(presignedUrl);
        } else if (cloudFileKey) {
            base64Image = await downloadFileAsBase64(cloudFileKey);
            if (!fileType) {
                const ext = cloudFileKey.split('.').pop()?.toLowerCase();
                fileType = ext === 'pdf' ? 'application/pdf' : `image/${ext}`;
            }
        } else if (!base64Image) {
            throw new Error("Missing cloudFileKey, presignedUrl and base64Image");
        }

        // 1. Classification
        console.log("[DocumentManager] Classifying document type...");
        const classificationRes = await callOpenRouterAPI(base64Image, fileType);
        const classResult = parseAnalysisResult(classificationRes.choices[0]?.message?.content || "{}");
        // default to prescription if it fails to ensure fallback, but for strictness:
        const docType = classResult.document_type || "invalid";
        const isHandwritten = classResult.is_handwritten === true;

        console.log(`[DocumentManager] Classification result: Type = ${docType}, Handwritten = ${isHandwritten} (Confidence: ${classResult.confidence})`);

        // 2. Routing & Type Update
        if (docType !== "invalid") {
            const mappedType = (docType === "lab_report" || docType === "report") ? "Lab Report" : "Prescription";
            console.log(`[DocumentManager] Updating documents.type to ${mappedType}`);
            const { error: typeUpdateError } = await supabase
                .from("documents")
                .update({ type: mappedType })
                .eq("id", documentId);

            if (typeUpdateError) {
                console.warn("[DocumentManager] Warning: Failed to update document type:", typeUpdateError.message);
            }
        }

        if (docType === "invalid") {
            const duration = Date.now() - startTime;
            console.log(`[DocumentManager] Invalid document detected. Reason: ${classResult.reasoning}`);

            await supabase.from("documents").update({
                ai_analysis_status: "completed",
                ai_analysis_result: {
                    document_type: "invalid",
                    error_reason: classResult.reasoning || "Unrecognized or invalid document type"
                },
                ai_analyzed_at: new Date().toISOString(),
            }).eq("id", documentId);

            return new Response(
                JSON.stringify({
                    success: true,
                    documentId,
                    pathway: "invalid",
                    duration,
                    analysis: {
                        document_type: "invalid",
                        error_reason: classResult.reasoning || "Unrecognized or invalid document type"
                    }
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Prepare forwarding
        let targetFunction = "";
        let forwardingBody = {
            ...body,
            base64Image,
            fileType
        };
        // Remove cloud paths since we already fetched it
        delete forwardingBody.presignedUrl;
        delete forwardingBody.cloudFileKey;

        if (docType === "lab_report" || docType === "report") {
            targetFunction = "analyze-report";
        } else {
            targetFunction = "prescription-analysis-multistep";
            forwardingBody.skipClassification = true;
            forwardingBody.isHandwritten = isHandwritten; // Pass down the modality to avoid re-checking
        }

        console.log(`[DocumentManager] Forwarding to ${targetFunction}...`);

        const { data, error } = await supabase.functions.invoke(targetFunction, {
            body: forwardingBody,
            headers: {
                Authorization: authHeader // Forward the auth!
            }
        });

        if (error) {
            console.error(`[DocumentManager] Upstream execution error from ${targetFunction}:`, error);
            throw error;
        }

        return new Response(
            JSON.stringify(data),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        console.error("[DocumentManager] Fatal error:", error);

        try {
            if (documentId) {
                const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
                await supabase.from("documents").update({
                    ai_analysis_status: "failed",
                    ai_analysis_error: { error: errorMessage, timestamp: new Date().toISOString() },
                }).eq("id", documentId);
            }
        } catch (updateError) {
            console.error("[DocumentManager] Failed to update document status:", updateError);
        }

        return new Response(
            JSON.stringify({ success: false, error: errorMessage, duration: Date.now() - startTime }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
