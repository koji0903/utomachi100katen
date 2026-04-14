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
        const body = await req.json();
        const {
            type,
            date,
            worker,
            storeName,
            weather,
            temp,
            content,
            storeTopics,
            officeNote,
            restocking
        } = body;

        const recordType = type === "store" ? "店舗メンテナンス" : type === "activity" ? "活動記録" : "事務所作業";
        const prompt = `
あなたは優秀な店舗経営コンサルタントおよびメンターです。
以下の業務日報（${recordType}）の内容を分析し、店舗運営の改善、モチベーション向上、または次のアクションへの具体的なアドバイスを「3つのポイント」で作成してください。

【日報情報】
日付: ${date}
提出者: ${worker}
店舗: ${storeName || "N/A"}
天気: ${weather || "N/A"} (${temp || "N/A"}℃)
内容:
${content || ""}
${storeTopics || ""}
${officeNote || ""}

【商品補充状況】
${restocking?.map((r: any) => `- ${r.productName}: ${r.qty}個`).join("\n") || "なし"}

【出力形式】
- 専門家としての鋭い分析かつ、温かみのあるアドバイスを心がけてください。
- 日本語で出力してください。
- 箇条書き（- ）形式で、3項目作成してください。
- 各項目は短く、かつ具体的であること。
`;

        const modelsToTry = [
            "gemini-2.5-flash",
            "gemini-2.0-flash-001",
            "gemini-1.5-flash",
            "gemini-1.5-pro"
        ];
        
        let responseText = "";
        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                responseText = result.response.text();
                if (responseText) break;
            } catch (err) {
                console.error(`Error with ${modelName}:`, err);
                continue;
            }
        }

        if (!responseText) {
            throw new Error("Could not generate analysis from any model");
        }

        return NextResponse.json({ analysis: responseText.trim() });
    } catch (error: any) {
        console.error("Analysis API Error:", error);
        return NextResponse.json(
            { error: "Failed to analyze report", detail: error?.message || String(error) },
            { status: 500 }
        );
    }
}
