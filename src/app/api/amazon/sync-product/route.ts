import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue, getAdminDb } from "@/lib/firebase-admin";
import { updateAmazonListing } from "@/lib/amazon";
import { withAuth, parseJson, internalError, logError } from "@/lib/apiAuth";

const bodySchema = z.object({
    productId: z.string().min(1).max(128),
});

/**
 * 商品の在庫・価格を Amazon に同期（プッシュ）する認証付き API
 */
export const POST = withAuth(async (req, ctx) => {
    const parsed = await parseJson(req, bodySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { productId } = parsed;

    try {
        const db = getAdminDb();
        if (!db) {
            logError("amazon/sync-product", new Error("Firestore adminDb is not initialized"), { uid: ctx.uid });
            return internalError();
        }

        const productRef = db.collection("products").doc(productId);
        const productSnap = await productRef.get();

        if (!productSnap.exists) {
            return NextResponse.json(
                { success: false, message: "商品は存在しません。" },
                { status: 404 },
            );
        }

        const product = productSnap.data();
        if (!product) {
            return NextResponse.json(
                { success: false, message: "商品データが取得できませんでした。" },
                { status: 404 },
            );
        }

        if (product.isTrashed === true) {
            return NextResponse.json(
                { success: false, message: "削除済みの商品は同期できません。" },
                { status: 400 },
            );
        }

        if (!product.amazonSyncEnabled || !product.amazonSku) {
            return NextResponse.json({
                success: false,
                message: "Amazon同期が無効です。",
            });
        }

        const success = await updateAmazonListing(
            String(product.amazonSku),
            Number(product.stock ?? 0),
            Number(product.sellingPrice ?? 0),
        );

        if (success) {
            await productRef.update({
                lastAmazonSyncAt: FieldValue.serverTimestamp(),
            });
            return NextResponse.json({
                success: true,
                message: "Amazonとの同期に成功しました。",
            });
        }

        return NextResponse.json(
            {
                success: false,
                message: "Amazonとの同期に失敗しました。APIエラーを確認してください。",
            },
            { status: 502 },
        );
    } catch (error) {
        logError("amazon/sync-product", error, { uid: ctx.uid, productId });
        return internalError();
    }
});
