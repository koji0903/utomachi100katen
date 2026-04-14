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
            period,
            viewMode,
            kpis,
            abcAnalysis,
            recentReports,
            storeDistribution
        } = body;

        const prompt = `
あなたはウトマチ百貨店の経営執行責任者（COO）兼戦略コンサルタントです。
以下の事業データ（${viewMode === "monthly" ? "月次" : "日次"}分析: ${period}）に基づき、経営的な視点での詳細な「経営分析レポート」を作成してください。

【1. KPIサマリー】
売上高: ¥${kpis.totalRevenue.toLocaleString()}
粗利益: ¥${kpis.grossProfit.toLocaleString()}
純利益: ¥${kpis.totalNetProfit.toLocaleString()}
原価率: ${kpis.cogRate.toFixed(1)}%

【2. ABC分析（主要商品）】
${abcAnalysis.slice(0, 5).map((p: any) => `- ${p.name}: ¥${p.revenue.toLocaleString()} (ランク${p.group})`).join("\n")}

【3. 店舗別売上シェア】
${storeDistribution.map((s: any) => `- ${s.name}: ¥${s.value.toLocaleString()}`).join("\n")}

【4. 現場からの直近トピック（日報要約）】
${recentReports?.length > 0 ? recentReports.map((r: any) => `- ${r.summary}`).join("\n") : "特記事項なし"}

---
【レポート作成指示】
1. **経営概況サマリー**: 今期のパフォーマンスを経営者として厳しくも温かく総括してください。
2. **利益構造の分析**: 原価率や利益の源泉となっている商品の観点から、改善の余地を指摘してください。
3. **現場と数値の相関**: 日報にある現場の状況が、どのように売上や利益に作用しているか（あるいは乖離しているか）を読み解いてください。
4. **戦略的アクション案**: 短期および中長期で取り組むべき次の一手を、具体的に3つ提案してください。

【出力形式】
- 日本語で出力してください。
- 威厳と知性を感じさせるプロフェッショナルな文体で作成してください。
- マークダウン形式で、セクションごとに見出しを付けてください。
`;

        const modelsToTry = [
            "gemini-2.5-flash",
            "gemini-2.0-flash-001",
            "gemini-1.5-flash-latest"
        ];
        
        let responseText = "";
        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                responseText = result.response.text();
                if (responseText) break;
            } catch (err) {
                console.error(`Management API Error with ${modelName}:`, err);
                continue;
            }
        }

        if (!responseText) {
            throw new Error("Could not generate management report");
        }

        return NextResponse.json({ report: responseText.trim() });
    } catch (error: any) {
        console.error("Management API Error:", error);
        return NextResponse.json(
            { error: "Failed to generate report", detail: error?.message || String(error) },
            { status: 500 }
        );
    }
}
