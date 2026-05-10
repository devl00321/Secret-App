const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env' });

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

async function listModels() {
  if (!API_KEY) {
    console.error("API Key is missing!");
    return;
  }
  
  const genAI = new GoogleGenerativeAI(API_KEY);
  try {
    // The Node SDK doesn't have a direct listModels, we have to use fetch or a different library
    // But we can test specific ones
    const models = ["gemini-1.5-flash", "gemini-1.5-flash-001", "gemini-1.5-flash-002", "gemini-1.5-pro", "gemini-pro"];
    
    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        await model.generateContent("test");
        console.log(`✅ Model ${m} is available!`);
      } catch (e) {
        console.log(`❌ Model ${m} failed: ${e.message}`);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

listModels();
