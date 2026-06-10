// scratch/list-shopify-order-details.ts
import fs from "fs";
import path from "path";

// .env.local を手動でパースして環境変数に設定する
try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, "utf-8");
        envConfig.split("\n").forEach((line) => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || "";
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                } else if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        });
    }
} catch (err: any) {
    console.error("Failed to load env:", err.message);
}

const targetOrderIds = ["7562019799336", "7454864146728", "7411240010024"];

async function printOrderDetails() {
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    if (!domain || !token) {
        console.error("Shopify env parameters missing.");
        return;
    }

    console.log("=== Shopify 注文詳細取得開始 ===");
    const details = [];

    for (const orderId of targetOrderIds) {
        const url = `https://${domain}/admin/api/2024-01/orders/${orderId}.json`;
        try {
            const response = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": token,
                }
            });

            if (!response.ok) {
                console.error(`Failed to fetch order ${orderId}`);
                continue;
            }

            const data = await response.json();
            const order = data.order;
            if (order) {
                details.push({
                    id: order.id.toString(),
                    name: order.name,
                    createdAt: order.created_at,
                    financialStatus: order.financial_status,
                    totalPrice: order.total_price,
                    email: order.email || "(なし)",
                    lineItems: order.line_items.map((item: any) => ({
                        title: item.title,
                        variantTitle: item.variant_title || "",
                        variantId: item.variant_id?.toString() || "",
                        sku: item.sku || "(なし)",
                        quantity: item.quantity,
                        price: item.price
                    }))
                });
            }
        } catch (e: any) {
            console.error(`Error: ${e.message}`);
        }
    }

    console.log("=== DETAIL_START ===");
    console.log(JSON.stringify(details, null, 2));
    console.log("=== DETAIL_END ===");
}

printOrderDetails();
