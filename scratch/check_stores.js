const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function checkStores() {
    try {
        const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountStr) {
            console.error("FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local");
            return;
        }
        const serviceAccount = JSON.parse(serviceAccountStr);

        initializeApp({
            credential: cert(serviceAccount)
        });

        const db = getFirestore();
        const snapshot = await db.collection('retailStores').get();
        console.log(`Found ${snapshot.size} stores.`);
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`Store: ${data.name}, Lat: ${data.lat}, Lng: ${data.lng}`);
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

checkStores();
