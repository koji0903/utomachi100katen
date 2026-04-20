// src/app/api/shopify/webhook/route.ts

import { NextResponse } from "next/server";
import crypto from "crypto";
import { processShopifyOrder } from "@/lib/shopify-processor";
import { logError } from "@/lib/apiAuth";

const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

/**
 * Shopify Webhook エンドポイント
 * 注文の作成または支払い完了時に呼び出される想定
 */
export async function POST(req: Request) {
    try {
        const body = await req.text();
        const hmac = req.headers.get("X-Shopify-Hmac-Sha256");

        if (!WEBHOOK_SECRET) {
            logError("shopify/webhook", new Error("SHOPIFY_WEBHOOK_SECRET not configured"));
            return NextResponse.json({ error: "Server error" }, { status: 500 });
        }

        if (!hmac) {
            logError("shopify/webhook", new Error("Missing X-Shopify-Hmac-Sha256 header"));
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const generatedHmac = crypto
            .createHmac("sha256", WEBHOOK_SECRET)
            .update(body, "utf8")
            .digest("base64");

        if (generatedHmac !== hmac) {
            logError("shopify/webhook", new Error("Invalid HMAC signature"), { expected: hmac, received: generatedHmac });
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const orderData = JSON.parse(body);

        // 2. 注文データのパース (ShopifyOrder インターフェースに合わせる)
        const order = {
            shopifyOrderId: orderData.id.toString(),
            createdAt: orderData.created_at,
            financialStatus: orderData.financial_status,
            totalPrice: parseFloat(orderData.total_price),
            lineItems: orderData.line_items.map((item: any) => ({
                variantId: item.variant_id?.toString() || "",
                sku: item.sku || "",
                quantity: item.quantity,
                price: parseFloat(item.price),
            })),
        };

        // 3. 注文処理の実行 (Firestore 更新・在庫減算)
        const result = await processShopifyOrder(order);

        if (result.success) {
            return NextResponse.json({ success: true, transactionId: result.transactionId });
        } else {
            // 重複などの場合は 200 を返して Shopify 側の再送を止める
            return NextResponse.json({ success: false, reason: result.reason });
        }

    } catch (error) {
        logError("shopify/webhook", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
