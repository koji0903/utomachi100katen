import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { generateCopyPrompt } from "@/lib/aiPromptUtils";
import { withAuth, parseJson, internalError, logError } from "@/lib/apiAuth";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const bodySchema = z.object({
    mode: z.string().max(64).default(""),
    name: z.string().max(200).optional(),
    brand: z.string().max(200).optional(),
    variant: z.string().max(200).optional(),
    producerStory: z.string().max(4000).optional(),
    regionBackground: z.string().max(4000).optional(),
    servingSuggestion: z.string().max(4000).optional(),
    story: z.string().max(4000).optional(),
    concept: z.string().max(4000).optional(),
    isBrandLevel: z.boolean().optional(),
}).refine(
    (v) => (v.name && v.name.length > 0) || (v.brand && v.brand.length > 0),
    { message: "name or brand is required" },
);

export const POST = withAuth(async (req, ctx) => {
    if (!genAI) {
        logError("generate-copy", new Error("GEMINI_API_KEY missing"));
        return internalError();
    }

    const parsed = await parseJson(req, bodySchema);
    if (parsed instanceof NextResponse) return parsed;

    try {
        const fullPrompt = generateCopyPrompt(parsed);
        const modelsToTry = [
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.0-flash-001",
            "gemini-1.5-pro-latest",
        ];
        let responseText = "";
        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(fullPrompt);
                responseText = result.response.text();
                if (responseText) break;
            } catch (err) {
                const msg = (err as { message?: string })?.message || "";
                if (
                    msg.includes("429") ||
                    msg.includes("quota") ||
                    msg.includes("limit") ||
                    msg.includes("503") ||
                    msg.includes("404")
                ) {
                    continue;
                }
                continue;
            }
        }

        if (!responseText) {
            return NextResponse.json(
                { error: "quota_exceeded" },
                { status: 429 },
            );
        }

        return NextResponse.json({ copy: responseText.trim() });
    } catch (err) {
        logError("generate-copy", err, { uid: ctx.uid });
        return internalError();
    }
});
