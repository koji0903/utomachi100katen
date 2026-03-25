import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateStoryPrompt } from "@/lib/aiPromptUtils";

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
        const { name, brand } = body;

        if (!name || !brand) {
            return NextResponse.json(
                { error: "Name and Brand are required fields" },
                { status: 400 }
            );
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = generateStoryPrompt(body);

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return NextResponse.json({ story: responseText.trim() });
    } catch (error) {
        console.error("Gemini API Error:", error);
        return NextResponse.json(
            { error: "Failed to generate story" },
            { status: 500 }
        );
    }
}
