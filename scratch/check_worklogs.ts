import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import * as path from "path";
import * as fs from "fs";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    // Extract FIREBASE_SERVICE_ACCOUNT_KEY using regex
    const matchKey = content.match(/FIREBASE_SERVICE_ACCOUNT_KEY='([\s\S]+?)'/);
    if (matchKey) {
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY = matchKey[1];
    }
}

const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!saKey) {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY is missing in env");
    process.exit(1);
}

const sa = JSON.parse(saKey);
sa.private_key = sa.private_key.replace(/\\n/g, '\n');

initializeApp({
    credential: cert(sa),
    projectId: sa.project_id,
});

const db = getFirestore();
const auth = getAuth();

async function check() {
    console.log("=== Auth Users ===");
    try {
        const usersResult = await auth.listUsers(100);
        usersResult.users.forEach(u => {
            console.log(`UID: ${u.uid} | Email: ${u.email} | DisplayName: ${u.displayName}`);
        });
    } catch (err: any) {
        console.error("Failed to list auth users:", err.message);
    }

    console.log("\n=== workLogs Sample Docs ===");
    try {
        const snap = await db.collection("workLogs").limit(20).get();
        if (snap.empty) {
            console.log("No workLogs found");
        } else {
            snap.forEach(doc => {
                console.log(`Doc ID: ${doc.id}`);
                const data = doc.data();
                console.log(`  workDate: ${data.workDate} | workerName: ${data.workerName} | workType: ${data.workType} | relatedProductName: ${data.relatedProductName}`);
                console.log(`  Keys: ${Object.keys(data).join(', ')}`);
                console.log(`  ownerId: ${data.ownerId || data.owner_id || 'N/A'} | producerId: ${data.producerId || 'N/A'}`);
            });
        }
    } catch (err: any) {
        console.error("Failed to get workLogs:", err.message);
    }
}

check().catch(console.error);
