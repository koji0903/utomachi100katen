// src/app/api/square/sync/route.ts

import { NextResponse } from "next/server";
import { getSquareOrders, updateSquareInventory, findSquareCatalogByJan } from "@/lib/square";

/**
 * Square Proxy API
 * サーバー側でしか実行できない Square API 通信を代行します。
 * Firestore へのアクセスは権限の関係で失敗するため、ここでは行いません。
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, locationId, inventoryUpdates, janCode } = body;

        // 1. Location ID 取得 (環境変数またはクライアントからの提供)
        const squareLocationId = locationId || process.env.SQUARE_LOCATION_ID;

        if (action !== "find-catalog" && !squareLocationId) {
            throw new Error("Location ID が不足しています。");
        }

        // --- Action 別の処理 ---

        // A. 注文データの取得
        if (action === "fetch-orders") {
            if (!squareLocationId) throw new Error("Location ID is missing.");
            
            // 直近1週間に制限
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const beginTime = sevenDaysAgo.toISOString();

            const orders = await getSquareOrders(squareLocationId, beginTime);
            return NextResponse.json({ success: true, orders, locationId: squareLocationId });
        }


        // B. 在庫の反映 (System -> Square)
        if (action === "update-inventory") {
            if (!squareLocationId || !inventoryUpdates) throw new Error("Required parameters missing.");
            await updateSquareInventory(squareLocationId, inventoryUpdates);
            return NextResponse.json({ success: true });
        }

        // C. カタログ検索 (JAN -> Catalog ID)
        if (action === "find-catalog") {
            if (!janCode) throw new Error("JAN code is missing.");
            const catalogObj = await findSquareCatalogByJan(janCode);
            return NextResponse.json({ success: true, catalogObj });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("Square API Proxy Error:", error);
        return NextResponse.json(
            { 
                error: "Square APIとの通信に失敗しました。", 
                detail: error.message,
                hint: error.message.includes("401") ? "APIアクセストークンが無効です。" : 
                      error.message.includes("404") ? "Location IDが見つからないか正しくありません。" : undefined
            },
            { status: 500 }
        );
    }
}
