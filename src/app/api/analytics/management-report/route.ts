import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { withAuth, parseJson, internalError, logError } from "@/lib/apiAuth";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const kpisSchema = z.object({
    totalRevenue: z.number(),
    grossProfit: z.number(),
    totalNetProfit: z.number(),
    cogRate: z.number(),
}).passthrough();

const abcItemSchema = z.object({
    name: z.string().max(200),
    revenue: z.number(),
    group: z.string().max(8),
}).passthrough();

const topProductSchema = z.object({
    name: z.string().max(200),
    qty: z.number(),
}).passthrough();

const targetStoreSchema = z.object({
    name: z.string().max(200),
    revenue: z.number(),
    share: z.number(),
    topProducts: z.array(topProductSchema).max(50),
}).passthrough();

const recentReportSchema = z.object({
    date: z.string().max(40),
    summary: z.string().max(1000),
}).passthrough();

const bodySchema = z.object({
    period: z.string().max(64),
    viewMode: z.enum(["daily", "monthly"]).optional(),
    kpis: kpisSchema,
    abcAnalysis: z.array(abcItemSchema).max(500),
    recentReports: z.array(recentReportSchema).max(100).optional(),
    storeDistribution: z.unknown().optional(),
    weatherSummary: z.string().max(4000).optional(),
    targetStoreTrends: targetStoreSchema.optional(),
});

export const POST = withAuth(async (req, ctx) => {
    if (!genAI) {
        logError("analytics/management-report", new Error("GEMINI_API_KEY missing"));
        return internalError();
    }

    const parsed = await parseJson(req, bodySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { period, viewMode, kpis, abcAnalysis, recentReports, weatherSummary, targetStoreTrends } = parsed;

    const prompt = `
あなたはウトマチ百貨店の経営執行責任者（COO）兼戦略コンサルタントです。
以下の事業データ（${viewMode === "monthly" ? "月次" : "日次"}分析: ${period}）に基づき、経営的な視点での詳細な「経営分析レポート」を作成してください。

【1. KPIサマリー】
売上高: ¥${kpis.totalRevenue.toLocaleString()}
粗利益: ¥${kpis.grossProfit.toLocaleString()}
純利益: ¥${kpis.totalNetProfit.toLocaleString()}
原価率: ${kpis.cogRate.toFixed(1)}%

【2. 気象・環境データ】
${weatherSummary || "データなし"}

【3. 重点分析店舗（宇土マリーナ等）の概況】
${targetStoreTrends ? `
- 店舗名: ${targetStoreTrends.name}
- 売上高: ¥${targetStoreTrends.revenue.toLocaleString()} (全社シェア: ${targetStoreTrends.share.toFixed(1)}%)
- 主要販売商品: ${targetStoreTrends.topProducts.map((p) => `${p.name}(${p.qty}点)`).join(", ")}
` : "特記店舗データなし"}

【4. ABC分析（主要商品）】
${abcAnalysis.slice(0, 5).map((p) => `- ${p.name}: ¥${p.revenue.toLocaleString()} (ランク${p.group})`).join("\n")}

【5. 現場からの直近トピック（日報要約）】
${recentReports && recentReports.length > 0 ? recentReports.map((r) => `- ${r.date}: ${r.summary}`).join("\n") : "特記事項なし"}

---
【レポート作成指示】
1. **経営概況サマリー**: 今期のパフォーマンスを経営者として総括してください。
2. **多角的な相関分析**:
   - **天気と売上の因果関係**: 気象データが客足や特定商品の売上にどう影響したか、現場の声（日報）と併せて分析してください。
   - **商品構成と店舗特性**: 宇土マリーナ等の重点店舗で売れている商品と、全体のABC分析の結果から、どのような「売れる勝ちパターン」が見えるか読み解いてください。
3. **重点店舗へのフィードバック**: 宇土マリーナの今後の売上向上のために必要な施策（商品ラインナップの調整や販促のタイミング等）について具体的に言及してください。
4. **戦略的アクション案**: 短期および中長期で取り組むべき次の一手を、具体的に3つ提案してください。

【出力形式】
- 日本語で出力してください。
- 威厳と知性を感じさせるプロフェッショナルな文体で作成してください。
- **重要なキーワードや分析結果は、マークダウンの太字（**）で強調してください。**
- マークダウン形式で、セクションごとに見出し（#、##、###）を付けてください。
`;

    try {
        const modelsToTry = [
            "gemini-2.5-flash",
            "gemini-2.0-flash-001",
            "gemini-1.5-flash-latest",
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

        return NextResponse.json({ report: responseText.trim() });
    } catch (err) {
        logError("analytics/management-report", err, { uid: ctx.uid });
        return internalError();
    }
});
