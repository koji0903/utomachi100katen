const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function test() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("Using API Key:", apiKey ? "Present" : "Missing");
    const genAI = new GoogleGenerativeAI(apiKey);
    const models = ["gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-1.5-flash-8b"];

    for (const modelName of models) {
        try {
            console.log(`Testing model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello");
            console.log(`Success with ${modelName}:`, result.response.text());
            break;
        } catch (e) {
            console.error(`Failed with ${modelName}:`, e.message);
        }
    }
}

test();
