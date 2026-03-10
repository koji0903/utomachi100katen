/**
 * AI Prompt Utilities
 * Centralized logic for generating prompts for various AI content generation modes.
 */

export const BRAND_CONTEXT = `
あなたは「ウトマチ百貨店」の専属コピーライターです。
以下のブランドコンセプトを常に守ってください：

【ブランドコンセプト】
・「地域文化 × 丁寧さ × 少しの遊び心」
・「ヒトとモノをつなぐ架け橋」
・熊本県宇土市を中心に、地域の生産者・職人と共に育てる百貨店。
・地域の誇りを都市部の消費者へ届けることが使命。
・文章は親しみやすく、丁寧で、ときに遊び心を加える。
`.trim();

export interface GenerateCopyParams {
    mode: string;
    name?: string;
    brand?: string;
    variant?: string;
    producerStory?: string;
    regionBackground?: string;
    servingSuggestion?: string;
    story?: string;
    concept?: string;
    isBrandLevel?: boolean;
}

export function generateCopyPrompt(params: GenerateCopyParams): string {
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
    } = params;

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
・最大200文字程度. タイトルや前置きなしで指示文のみ出力。`;
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
    } else if (mode === "daily-report") {
        modeInstruction = `
【出力形式：Daily Report Story Mode】
日報の内容を元に、Instagram用の「活動報告ストーリー」を作成してください。
・「業務の裏側」：卸先での会話、店舗の雰囲気、ふとした気づきなど、読み手がその場にいるような臨場感のある内容に。
・トーン：非常に親しみやすく、温かみのある日記のような口調。
・構成：
  1. その日の印象的な出来事から始まる一行目
  2. 現場の様子や感情を交えた2〜3段落の文章
  3. 最後に、読んでくれた方への感謝や、地域への想いを込めた一言
  4. 関連ハッシュタグを10個程度。
・タイトルや前置きなしで本文から始める。`;
    } else if (mode === "video") {
        modeInstruction = `
【出力形式：Short Video Script Mode】
InstagramリールやTikTok用の、30〜60秒のショート動画台本を作成してください。
・フック：冒頭3秒で視線を釘付けにする「問いかけ」や「驚きの事実」。
・シーン構成：5〜6つのカット割り（映像の内容 ＋ テロップの内容）。
・ナレーション：感情に訴えかける、温かく丁寧な語り。
・BGMイメージ：宇土の風情や商品の雰囲気に合う音楽の指定。
・最後に「プロフィールをチェック」や「サイトを見てね」などのCTA。
・タイトルや前置きなしで、構成案のみ出力。`;
    } else {
        modeInstruction = `
【出力形式】
商品ストーリーとして150文字程度のテキストを作成してください。
タイトルや「わかりました」などの返答は不要です。`;
    }

    return `${BRAND_CONTEXT}

【${isBrandLevel ? "ブランド情報" : "商品情報"}】
${productOrBrandInfo}

${modeInstruction}`.trim();
}

export interface GenerateStoryParams {
    name: string;
    brand: string;
    features?: string;
}

export function generateStoryPrompt(params: GenerateStoryParams): string {
    const { name, brand, features } = params;
    return `あなたは「ウトマチ百貨店」の優秀なコピーライターです。
以下の情報を元に、商品一覧や詳細ページに載せるための、魅力的で短い商品ストーリー（150文字程度）を作成してください。

【商品情報】
商品名: ${name}
ブランド名: ${brand}
特徴や背景など: ${features || "特になし"}

【出力形式】
テキストのみ（150文字程度。タイトルや「わかりました」などの返答は不要です）`.trim();
}
