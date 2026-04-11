"use server";

import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { updateAmazonListing } from "@/lib/amazon";

/**
 * 商品の在庫・価格を Amazon に同期（プッシュ）します
 */
export async function syncProductToAmazon(productId: string) {
    try {
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);
        
        if (!productSnap.exists()) {
            throw new Error("商品は存在しません。");
        }

        const product = productSnap.data();
        
        if (!product.amazonSyncEnabled || !product.amazonSku) {
            console.log(`[Amazon push] Sync not enabled for ${product.name}`);
            return { success: false, message: "Amazon同期が無効です。" };
        }

        console.log(`[Amazon push] Syncing ${product.name} (SKU: ${product.amazonSku}) to Amazon...`);
        
        // Amazon にプッシュ（在庫と価格）
        const success = await updateAmazonListing(
            product.amazonSku, 
            product.stock, 
            product.sellingPrice
        );

        if (success) {
            await updateDoc(productRef, {
                lastAmazonSyncAt: serverTimestamp(),
            });
            return { success: true, message: "Amazonとの同期に成功しました。" };
        } else {
            return { success: false, message: "Amazonとの同期に失敗しました。APIエラーを確認してください。" };
        }
    } catch (error: any) {
        console.error("[syncProductToAmazon Error]", error);
        return { success: false, message: error.message };
    }
}
