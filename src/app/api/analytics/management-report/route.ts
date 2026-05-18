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
    totalExpenses: z.number().optional(),
    finalNetProfit: z.number().optional(),
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
    expensePieData: z.array(z.any()).optional(),
});

export const POST = withAuth(async (req, ctx) => {
    if (!genAI) {
        logError("analytics/management-report", new Error("GEMINI_API_KEY missing"));
        return internalError();
    }

    const parsed = await parseJson(req, bodySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { period, viewMode, kpis, abcAnalysis, recentReports, weatherSummary, targetStoreTrends, expensePieData } = parsed;

    const prompt = `
あなたはウトマチ百貨店の最高財務責任者（CFO）兼戦略コンサルタントです。
以下の詳細な事業データ（${viewMode === "monthly" ? "月次" : "日次"}分析: ${period}）に基づき、財務健全性の評価や損益分岐点分析を含む、詳細かつプロフェッショナルな「総合経営分析報告書」を作成してください。

【1. KPI財務サマリー】
- 売上高: ¥${kpis.totalRevenue.toLocaleString()}
- 売上総利益（粗利）: ¥${kpis.grossProfit.toLocaleString()} (原価率: ${kpis.cogRate.toFixed(1)}%)
- 手数料差引後利益 (店舗委託手数料控除後): ¥${kpis.totalNetProfit.toLocaleString()}
- 一般営業経費 (家賃・人件費・水道光熱費等): ¥${(kpis.totalExpenses || 0).toLocaleString()}
- 最終純利益 (営業利益): ¥${(kpis.finalNetProfit || 0).toLocaleString()} ${ (kpis.finalNetProfit || 0) < 0 ? "⚠️ 赤字" : "✅ 黒字" }

【2. 営業経費内訳（金額順）】
${expensePieData && expensePieData.length > 0 ? expensePieData.map((e) => `- ${e.name}: ¥${Number(e.value).toLocaleString()}`).join("\n") : "経費明細なし"}

【3. 気象・環境データ】
${weatherSummary || "データなし"}

【4. 重点分析店舗（宇土マリーナ等）の概況】
${targetStoreTrends ? `
- 店舗名: ${targetStoreTrends.name}
- 売上高: ¥${targetStoreTrends.revenue.toLocaleString()} (全社シェア: ${targetStoreTrends.share.toFixed(1)}%)
- 主要販売商品: ${targetStoreTrends.topProducts.map((p) => `${p.name}(${p.qty}点)`).join(", ")}
` : "特記店舗データなし"}

【5. ABC分析（主要商品ランク）】
${abcAnalysis.slice(0, 5).map((p) => `- ${p.name}: ¥${p.revenue.toLocaleString()} (ランク${p.group})`).join("\n")}

【6. 現場からの直近トピック（日報要約）】
${recentReports && recentReports.length > 0 ? recentReports.map((r) => `- ${r.date}: ${r.summary}`).join("\n") : "特記事項なし"}

---
【レポート作成指示】
1. **経営・財務概況の総括**: 
   売上高・粗利益率に加えて、一般営業経費の発生状況をふまえ、「最終純利益（営業利益）」が健全な水準であるかを財務視点で厳しく評価してください。
2. **限界利益・損益分岐点（BEP）に関するアドバイス**:
   - 今回の売上・原価・手数料・固定費データから概算的な損益分岐点（売上に対して固定費＋変動費が賄えるポイント）について触れ、利益率向上のための売上目標や固定費削減策を提案してください。
3. **経費（Overhead Expenses）の分析と最適化策**:
   - 地代家賃や人件費、水道光熱費などカテゴリ別の内訳から、コストが膨らんでいる部分を特定し、削減可能性やROI（投資対効果）を分析してください。
4. **多角的な要因分析（天気・店舗特性・勝ちパターン）**:
   - 気象と売上の関係、および宇土マリーナでの販売実績と全社ABC分析から見えるヒット商品の勝ちパターンを解説してください。
5. **戦略的アクションプラン**:
   - 財務の健全化と売上最大化を両立するために、短期および中長期で取り組むべき次の一手を、具体的かつ優先順位を明確にして3つ提案してください。

【出力形式】
- 日本語で出力してください。
- 威厳と知性を感じさせるプロフェッショナルなCFOの文体で作成してください。
- **重要な財務目標、削減すべき経費額、具体的な施策などのキーワードは、マークダウンの太字（**）で強調してください。**
- マークダウン形式で、セクションごとに見出し（#、##、###）を付けてください。
`;

    try {
        const modelsToTry = [
            "gemini-3.0-flash",
            "gemini-2.5-flash",
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
