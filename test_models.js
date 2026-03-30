const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

async function listModels() {
    let apiKey = "";
    try {
        const env = fs.readFileSync(".env.local", "utf8");
        const lines = env.split("\n");
        for (const line of lines) {
            if (line.startsWith("GEMINI_API_KEY=")) {
                apiKey = line.split("=")[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
                break;
            }
        }
    } catch (e) {}

    if (!apiKey) {
        console.error("API Key not found");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const testModels = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-2.0-flash-lite-preview-02-05"];
    for (const m of testModels) {
        try {
            console.log(`Testing model: ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Hi");
            console.log(`Model ${m} works! Response: ${result.response.text().substring(0, 10)}...`);
            break; // Found one!
        } catch (err) {
            console.log(`Model ${m} failed: ${err.message}`);
        }
    }
}

listModels();
