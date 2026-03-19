// src/app/api/shopify/webhook/route.ts

import { NextResponse } from "next/server";
import crypto from "crypto";
import { processShopifyOrder } from "@/lib/shopify-processor";

const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

/**
 * Shopify Webhook エンドポイント
 * 注文の作成または支払い完了時に呼び出される想定
 */
export async function POST(req: Request) {
    try {
        const body = await req.text();
        const hmac = req.headers.get("X-Shopify-Hmac-Sha256");

        // 1. HMAC 署名の検証
        if (WEBHOOK_SECRET) {
            const generatedHmac = crypto
                .createHmac("sha256", WEBHOOK_SECRET)
                .update(body, "utf8")
                .digest("base64");

            if (generatedHmac !== hmac) {
                console.error("[Shopify Webhook] Invalid HMAC signature.");
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }
        }

        const orderData = JSON.parse(body);
        console.log(`[Shopify Webhook] Received order: ${orderData.id}`);

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

    } catch (error: any) {
        console.error("Shopify Webhook Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", detail: error.message },
            { status: 500 }
        );
    }
}
