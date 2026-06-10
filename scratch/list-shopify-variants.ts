// scratch/list-shopify-variants.ts
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

async function listVariants() {
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    if (!domain || !token) {
        console.error("Shopify env parameters missing.");
        return;
    }

    const url = `https://${domain}/admin/api/2024-01/products.json?limit=250`;
    try {
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": token,
            }
        });

        if (!response.ok) {
            const err = await response.json();
            console.error("Shopify API Error:", err);
            return;
        }

        const data = await response.json();
        const products = data.products || [];

        console.log(`=== SHOPIFY_VARIANTS_START ===`);
        const resultList: any[] = [];
        
        products.forEach((p: any) => {
            p.variants?.forEach((v: any) => {
                resultList.push({
                    productTitle: p.title,
                    variantTitle: v.title === "Default Title" ? "" : v.title,
                    variantId: v.id.toString(),
                    sku: v.sku || "",
                    price: v.price
                });
            });
        });

        console.log(JSON.stringify(resultList, null, 2));
        console.log(`=== SHOPIFY_VARIANTS_END ===`);

    } catch (error: any) {
        console.error("Error fetching variants:", error.message);
    }
}

listVariants();
