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
            concept,
            isBrandLevel,
        } = await req.json();

        if (!name && !brand) {
            return NextResponse.json(
                { error: "Name or Brand is required" },
                { status: 400 }
            );
        }

        const productOrBrandInfo = isBrandLevel ? `
ブランド名: ${name}
ブランドコンセプト: ${concept || "（未入力）"}
ブランドストーリー: ${story || "（未入力）"}
` : `
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
【出力形式：Instagram / Social Mode】
Instagramでの投稿文を作成してください。
・「ストーリー重視」：単なる宣伝ではなく、商品の背景、生産者のこだわり、地域の風景が目に浮かぶような物語を語ってください。
・トーン：丁寧ですが、親しみやすく、温かみのある言葉使い。
・構成：
  1. 心を掴む「情緒的な一行目」
  2. 2〜3段落の短いストーリー（改行を多用して読みやすく）
  3. 最後に「体験」を促す一言（例：温かいお茶と一緒に、ゆったりとした時間をいかがですか？）
  4. 関連ハッシュタグを10個程度。
・絵文字を適度に使用し、視覚的な柔らかさを出してください。
・タイトルや前置きなしで本文から始める。`;
        } else if (mode === "image-prompt") {
            modeInstruction = `
【出力形式：Image Scene Mode】
この商品のストーリーや世界観を象徴する、Instagram用の「写真構成案（プロンプト）」を作成してください。
・Instagramで「いいね」がつくような、情緒的で美しいシーンを描写してください。
・構図、ライティング（柔らかな光など）、小道具（宇土の風景、木製のテーブル等）、色のトーンを具体的に。
・出力は、AI画像生成ツール（DALL-E 3等）にそのまま入力できる「詳細な指示文（日本語）」にしてください。
・最大200文字程度。タイトルや前置きなしで指示文のみ出力。`;
        } else if (mode === "pop") {
            modeInstruction = `
【出力形式：POP Mode】
店頭の棚札（POP）用の「ひとこと紹介文」を作成してください。
・一瞬で目が止まる、短くインパクトのある文章。
・最大50文字程度。
・魅力、食感、味の特長を凝縮。
・タイトルや前置きなしで本文のみ出力。`;
        } else if (mode === "manifesto" && isBrandLevel) {
            modeInstruction = `
【出力形式：Manifesto Mode】
ブランドの魂を揺さぶる「マニフェスト（宣言）」を作成してください。
・ブランドの存在意義、地域への想い、届ける価値を、詩的かつ力強く。
・一文ごとに改行し、リズム感のある構成に。
・全体200〜300字程度。
・タイトルや前置きなしで本文のみ出力。`;
        } else if (mode === "press" && isBrandLevel) {
            modeInstruction = `
【出力形式：Press Mode】
プレスリリースやメディア紹介用の、信頼感のある「ブランド紹介文」を作成してください。
・客観的かつ情熱的に、ブランドの価値を記述。
・全体300字程度。
・タイトルや前置きなしで本文のみ出力。`;
        } else {
            // fallback: simple story
            modeInstruction = `
【出力形式】
商品ストーリーとして150文字程度のテキストを作成してください。
タイトルや「わかりました」などの返答は不要です。`;
        }

        const fullPrompt = `${BRAND_CONTEXT}

【${isBrandLevel ? "ブランド情報" : "商品情報"}】
${productOrBrandInfo}

${modeInstruction}`;

        let responseText = "";
        // Try gemini-2.0-flash-lite first, fall back to gemini-1.5-flash if quota exceeded
        const modelsToTry = [
            "gemini-2.0-flash-lite",
            "gemini-2.0-flash",
            "gemini-2.5-flash",
            "gemini-flash-latest",
            "gemini-flash-lite-latest"
        ];
        let lastError: any = null;
        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(fullPrompt);
                responseText = result.response.text();
                break; // success
            } catch (_e) {
                lastError = _e;
                if (typeof _e === "object" && _e !== null && "message" in _e && typeof _e.message === "string" && _e.message.includes("429")) {
                    continue; // try next model
                }
                throw _e; // other error, rethrow
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
