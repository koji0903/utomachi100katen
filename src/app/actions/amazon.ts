"use server";

/**
 * @deprecated 未認証で外部から直接呼び出されるリスクを防ぐため廃止しました。
 * 認証付き API (`/api/amazon/sync-product`) を使用してください。
 */
export async function syncProductToAmazon(_productId: string) {
    const message = "認証付きAPI (/api/amazon/sync-product) を使用してください";
    return {
        success: false,
        error: message,
        message,
    };
}
