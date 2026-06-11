// scratch/list-shopify-customer-details.ts
import fs from "fs";
import path from "path";

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
} catch (err: any) {}

async function check() {
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const customerId = "10381718028584";

    const customerUrl = `https://${domain}/admin/api/2024-01/customers/${customerId}.json`;
    const response = await fetch(customerUrl, {
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": token,
        }
    });

    if (response.ok) {
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log("Failed to fetch customer details. Status:", response.status);
    }
}
check();
