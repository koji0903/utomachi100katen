import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
        const { name, brand, features } = await req.json();

        if (!name || !brand) {
            return NextResponse.json(
                { error: "Name and Brand are required fields" },
                { status: 400 }
            );
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `あなたは「ウトマチ百貨店」の優秀なコピーライターです。
以下の情報を元に、商品一覧や詳細ページに載せるための、魅力的で短い商品ストーリー（150文字程度）を作成してください。

【商品情報】
商品名: ${name}
ブランド名: ${brand}
特徴や背景など: ${features || "特になし"}

【出力形式】
テキストのみ（150文字程度。タイトルや「わかりました」などの返答は不要です）`;

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
