// src/app/api/expenses/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        const mimeType = file.type || "image/jpeg";

        const prompt = `
            添付された領収書またはレシート画像から、以下の情報を抽出してJSON形式で返してください。
            日本語で回答してください。
            
            返却するJSONフォーマット:
            {
                "date": "YYYY-MM-DD",
                "vendor": "店名・発行元",
                "amount": 数値(合計金額),
                "item": "購入品目の要約",
                "category": "以下のうち最も適切なもの: 備品, 消耗品, 飲食費, 交通費, 通信費, 光熱費, 広告宣伝費, 支払手数料, その他"
            }
            
            ※日付が不明な場合は、本日(${new Date().toISOString().split('T')[0]})を基準に推測するか、空欄にしてください。
            ※JSONのみを返却し、説明文などは含めないでください。
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType,
                },
            },
        ]);

        const responseText = result.response.text();
        // Remove markdown code blocks if present
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Could not parse AI response as JSON");
        }
        
        const analysis = JSON.parse(jsonMatch[0]);

        return NextResponse.json(analysis);
    } catch (error: any) {
        console.error("[AI-Analyze] Error:", error);
        return NextResponse.json(
            { error: "AI解析に失敗しました", details: error.message },
            { status: 500 }
        );
    }
}
