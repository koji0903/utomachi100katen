import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// ─── Brand Guidelines (fixed system context) ────────────────────────────────
const BRAND_CONTEXT = `
あなたは「ウトマチ百貨店」の専属コピーライターです。
以下のブランドコンセプトを常に守ってください：

【ブランドコンセプト】
・「地域文化 × 丁寧さ × 少しの遊び心」
・「ヒトとモノをつなぐ架け橋」
・熊本県宇土市を中心に、地域の生産者・職人と共に育てる百貨店。
・地域の誇りを都市部の消費者へ届けることが使命。
・文章は親しみやすく、丁寧で、ときに遊び心を加える。
`.trim();

export async function POST(req: Request) {
    if (!genAI) {
        return NextResponse.json(
            { error: "GEMINI_API_KEY environment variable is missing" },
            { status: 500 }
        );
    }

    try {
        const {
            mode,
            name,
            brand,
            variant,
            producerStory,
            regionBackground,
            servingSuggestion,
            story,
        } = await req.json();

        if (!name || !brand) {
            return NextResponse.json(
                { error: "Name and Brand are required" },
                { status: 400 }
            );
        }

        const productInfo = `
商品名: ${name}${variant ? `（${variant}）` : ""}
ブランド名: ${brand}
生産者の思い: ${producerStory || "（未入力）"}
地域・背景: ${regionBackground || "（未入力）"}
おすすめの食べ方: ${servingSuggestion || "（未入力）"}
その他メモ: ${story || "（なし）"}
`.trim();

        let modeInstruction = "";
        if (mode === "marketplace") {
            modeInstruction = `
【出力形式：Marketplace Mode】
Amazon・Shopify等のECサイト向け商品説明文を作成してください。
・SEOを意識し、商品名・特長・こだわりを具体的に記述。
・読者は日本全国の消費者。
・冒頭に魅力的なキャッチコピー1文、続いて3〜4文の詳細説明。
・全体300〜400字程度。タイトルや前置きなしで本文のみ出力。`;
        } else if (mode === "story") {
            modeInstruction = `
【出力形式：Story Mode】
ウトマチ百貨店のホームページやブログ用コラム文を作成してください。
・熊本県宇土の文化・風土・生産者のこだわりを物語風に描写。
・読者は地域の食と文化に関心を持つ方。
・人と物の繋がりを感じさせる文体で、暖かみを表現。
・全体400〜500字程度。タイトルや前置きなしで本文のみ出力。`;
        } else if (mode === "social") {
            modeInstruction = `
【出力形式：Social Mode】
Instagram・X（Twitter）等のSNS用の投稿文を作成してください。
・「少しの遊び心」を盛り込み、フォロワーが思わずシェアしたくなる文体。
・改行を活かしてテンポよく。絵文字を2〜3個使ってOK。
・本文120字以内（短く！）のあと、改行して関連ハッシュタグを5個。
・タイトルや前置きなしで本文から始める。`;
        } else {
            // fallback: simple story
            modeInstruction = `
【出力形式】
商品ストーリーとして150文字程度のテキストを作成してください。
タイトルや「わかりました」などの返答は不要です。`;
        }

        const fullPrompt = `${BRAND_CONTEXT}

【商品情報】
${productInfo}

${modeInstruction}`;

        let responseText = "";
        // Try gemini-2.0-flash-lite first, fall back to gemini-1.5-flash if quota exceeded
        const modelsToTry = ["gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-1.5-flash-8b"];
        let lastError: any = null;
        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(fullPrompt);
                responseText = result.response.text();
                break; // success
            } catch (e: any) {
                lastError = e;
                if (e?.message?.includes("429")) {
                    continue; // try next model
                }
                throw e; // other error, rethrow
            }
        }

        if (!responseText) {
            return NextResponse.json(
                { error: "quota_exceeded", detail: "本日の無料利用枠を使い切りました。明日以降に再度お試しいただくか、Google AI StudioでAPIキーの有料プランを有効にしてください。" },
                { status: 429 }
            );
        }

        return NextResponse.json({ copy: responseText.trim() });
    } catch (error: any) {
        console.error("Gemini API Error:", error?.message || error);
        return NextResponse.json(
            { error: "Failed to generate copy", detail: error?.message || String(error) },
            { status: 500 }
        );
    }
}
