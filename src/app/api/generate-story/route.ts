import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { generateStoryPrompt } from "@/lib/aiPromptUtils";
import { withAuth, parseJson, internalError, logError } from "@/lib/apiAuth";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const bodySchema = z.object({
    name: z.string().min(1).max(200),
    brand: z.string().min(1).max(200),
}).passthrough();

export const POST = withAuth(async (req, ctx) => {
    if (!genAI) {
        logError("generate-story", new Error("GEMINI_API_KEY missing"));
        return internalError();
    }

    const parsed = await parseJson(req, bodySchema);
    if (parsed instanceof NextResponse) return parsed;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = generateStoryPrompt(parsed);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        return NextResponse.json({ story: responseText.trim() });
    } catch (err) {
        logError("generate-story", err, { uid: ctx.uid });
        return internalError();
    }
});
