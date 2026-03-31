// src/app/api/expenses/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
            添付された領収書、レシート、または請求書の画像・PDFから、経理処理に必要な情報を正確に抽出してJSON形式で返してください。
            文字が不鮮明な場合でも、文脈から推測して最適な値を入力してください。
            
            返却するJSONフォーマット:
            {
                "date": "YYYY-MM-DD (見当たらない場合は空欄)",
                "vendor": "発行元・店名 (正式名称)",
                "amount": 数値 (税込合計金額のみ、カンマや円記号は含めない)",
                "item": "購入内容の簡潔な要約 (例: 事務用品代、タクシー代)",
                "category": "以下のうち最も適切なもの: 備品, 消耗品, 飲食費, 交通費, 通信費, 光熱費, 広告宣伝費, 支払手数料, その他",
                "paymentMethod": "以下のうち最も適切なもの: クレジット, 小口現金"
            }
            
            判定基準:
            - 出納方法: クレジットカード利用の形跡（カード番号の一部、承認番号、"クレジット"の文字など）があれば「クレジット」、それ以外は「小口現金」と判断してください。
            
            カテゴリーの判定基準:
            - 備品: PC、家具、10万円以上の高額な物品
            - 消耗品: 文房具、日用品、コピー用紙
            - 飲食費: 会食、カフェ、弁当、打ち合わせ時の茶菓子
            - 交通費: 電車、バス、タクシー、ガソリン代
            - 通信費: 切手、インターネット、携帯電話
            - 光熱費: 電気、水道、ガス
            - 広告宣伝費: チラシ、Web広告、SNS広告
            - 支払手数料: 振込手数料、各種登録料
            
            ※JSONのみを返却し、Markdownのコードブロックなどは含めないでください。
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
        
        // Match JSON object even if there's surrounding text or markdown
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("[AI-Analyze] Raw Response:", responseText);
            throw new Error("AIのレスポンスからJSONを抽出できませんでした");
        }
        
        const analysis = JSON.parse(jsonMatch[0]);

        return NextResponse.json(analysis);
    } catch (error: any) {
        console.error("[AI-Analyze] Error:", error);
        const errorMessage = error.message || "Unknown error";
        return NextResponse.json(
            { error: "AI解析に失敗しました", details: errorMessage },
            { status: 500 }
        );
    }
}
