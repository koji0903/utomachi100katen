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

const reportSchema = z.object({
    date: z.string().max(40).optional(),
    type: z.string().max(40).optional(),
    storeName: z.string().max(200).optional(),
    worker: z.string().max(200).optional(),
    content: z.string().max(4000).optional(),
    storeTopics: z.string().max(4000).optional(),
    officeNote: z.string().max(4000).optional(),
    aiAnalysis: z.string().max(8000).optional(),
    restocking: z.array(restockSchema).max(200).optional(),
}).passthrough();

const bodySchema = z.object({
    reports: z.array(reportSchema).max(200),
});

export const GET = () => {
    return NextResponse.json({ message: "AI summary endpoint is active. Use POST to analyze reports." });
};

export const POST = withAuth(async (req, ctx) => {
    if (!genAI) {
        logError("reports/summary", new Error("GEMINI_API_KEY missing"));
        return internalError();
    }

    const parsed = await parseJson(req, bodySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { reports } = parsed;

    if (!reports || reports.length === 0) {
        return NextResponse.json({ summary: "分析対象の日報がまだありません。" });
    }

    const reportsText = reports.map((r) => `
[${r.date ?? ""}] ${r.type === "store" ? `店舗: ${r.storeName ?? ""}` : "活動記録"} (担当: ${r.worker ?? ""})
内容: ${r.content || r.storeTopics || r.officeNote || ""}
補充: ${r.restocking?.map((i) => `${i.productName}(${i.qty})`).join(", ") || "なし"}
AIアドバイス: ${r.aiAnalysis || "なし"}
-------------------`).join("\n");

    const prompt = `
あなたはウトマチ百貨店の経営アドバイザー兼スーパーバイザーです。
以下の直近の日報データを読み解き、店舗運営の全体的な傾向と、今後1週間の戦略的なアドバイスをまとめてください。

【直近の日報データ】
${reportsText}

【出力指示】
ユーザー（店長や運営スタッフ）がダッシュボードで見て、今の状況を正しく把握し、明日からの活力になるような内容にしてください。
以下の3つの見出し（セクション）で構成し、それぞれ短く的確に（2〜3項目ずつ）まとめてください。

1. 🟢 ポジティブな動向
   - 現場での成功事例、改善が見られた点、スタッフの活発な活動など。
2. 🟡 課題・注意が必要な点
   - 在庫状況、オペレーションの懸念、天候や客層の変化に伴うリスクなど。
3. 🔵 今週の重点アクション
   - すぐに取り組むべき具体的な行動指針。

【出力形式】
- 日本語で出力してください。
- 箇条書き（- ）を使用してください。
- 見出し（1. 🟢 ポジティブな動向、など）は必ず含めてください。
`;

    try {
        const modelsToTry = [
            "gemini-3.0-flash",
            "gemini-3-flash",
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

        return NextResponse.json({ summary: responseText.trim() });
    } catch (err) {
        logError("reports/summary", err, { uid: ctx.uid });
        return internalError();
    }
});
