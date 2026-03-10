import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateCopyPrompt } from "@/lib/aiPromptUtils";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: Request) {
    if (!genAI) {
        return NextResponse.json(
            { error: "GEMINI_API_KEY environment variable is missing" },
            { status: 500 }
        );
    }

    try {
        const body = await req.json();
        const {
            mode,
            name,
            brand,
            variant,
            producerStory,
            regionBackground,
            servingSuggestion,
            story,
            concept,
            isBrandLevel,
        } = body;

        if (!name && !brand) {
            return NextResponse.json(
                { error: "Name or Brand is required" },
                { status: 400 }
            );
        }

        const fullPrompt = generateCopyPrompt(body);

        let responseText = "";
        // Prioritize Pro models for maximum intelligence
        const modelsToTry = [
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite-preview-02-05",
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-pro",
            "gemini-1.5-pro-latest"
        ];
        let lastError: any = null;
        for (const modelName of modelsToTry) {
            try {
                console.log(`[Gemini] Attempting with model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(fullPrompt);
                responseText = result.response.text();
                if (responseText) {
                    console.log(`[Gemini] Success with model: ${modelName}`);
                    break;
                }
            } catch (_e: any) {
                lastError = _e;
                const errorMsg = _e?.message || String(_e);
                console.warn(`[Gemini] Failed to use model ${modelName}:`, errorMsg);

                // If it's a quota error or other retryable error, try the next model
                if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit") || errorMsg.includes("503") || errorMsg.includes("404")) {
                    continue;
                }
                // For other errors, we might want to stop, but let's try all models anyway for safety
                continue;
            }
        }

        if (!responseText) {
            return NextResponse.json(
                { error: "quota_exceeded", detail: "本日の無料利用枠を使い切りました。明日以降に再度お試しいただくか、Google AI StudioでAPIキーの有料プランを有効にしてください。" },
                { status: 429 }
            );
        }

        return NextResponse.json({ copy: responseText.trim() });
    } catch (error: any) {
        console.error("Gemini API Error:", error?.message || error);
        return NextResponse.json(
            { error: "Failed to generate copy", detail: error?.message || String(error) },
            { status: 500 }
        );
    }
}
