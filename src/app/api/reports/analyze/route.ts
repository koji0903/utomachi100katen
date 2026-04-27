import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { withAuth, parseJson, internalError, logError } from "@/lib/apiAuth";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const restockSchema = z.object({
    productName: z.string().max(200),
    qty: z.number(),
}).passthrough();

const bodySchema = z.object({
    type: z.enum(["store", "activity", "office"]).optional(),
    date: z.string().max(40).optional(),
    worker: z.string().max(200).optional(),
    storeName: z.string().max(200).optional(),
    weather: z.string().max(200).optional(),
    temp: z.union([z.string(), z.number()]).optional(),
    content: z.string().max(4000).optional(),
    storeTopics: z.string().max(4000).optional(),
    officeNote: z.string().max(4000).optional(),
    restocking: z.array(restockSchema).max(200).optional(),
});

export const POST = withAuth(async (req, ctx) => {
    if (!genAI) {
        logError("reports/analyze", new Error("GEMINI_API_KEY missing"));
        return internalError();
    }

    const parsed = await parseJson(req, bodySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { type, date, worker, storeName, weather, temp, content, storeTopics, officeNote, restocking } = parsed;

    const recordType = type === "store" ? "店舗メンテナンス" : type === "activity" ? "活動記録" : "事務所作業";
    const prompt = `
あなたは優秀な店舗経営コンサルタントおよびメンターです。
以下の業務日報（${recordType}）の内容を分析し、店舗運営の改善、モチベーション向上、または次のアクションへの具体的なアドバイスを「3つのポイント」で作成してください。

【日報情報】
日付: ${date ?? ""}
提出者: ${worker ?? ""}
店舗: ${storeName || "N/A"}
天気: ${weather || "N/A"} (${temp ?? "N/A"}℃)
内容:
${content || ""}
${storeTopics || ""}
${officeNote || ""}

【商品補充状況】
${restocking?.map((r) => `- ${r.productName}: ${r.qty}個`).join("\n") || "なし"}

【出力形式】
- 専門家としての鋭い分析かつ、温かみのあるアドバイスを心がけてください。
- 日本語で出力してください。
- 箇条書き（- ）形式で、3項目作成してください。
- 各項目は短く、かつ具体的であること。
`;

    try {
        const modelsToTry = [
            "gemini-3.0-flash",
            "gemini-2.5-flash",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
        ];
        let responseText = "";
        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                responseText = result.response.text();
                if (responseText) break;
            } catch {
                continue;
            }
        }

        if (!responseText) {
            return NextResponse.json({ error: "quota_exceeded" }, { status: 429 });
        }

        return NextResponse.json({ analysis: responseText.trim() });
    } catch (err) {
        logError("reports/analyze", err, { uid: ctx.uid });
        return internalError();
    }
});
