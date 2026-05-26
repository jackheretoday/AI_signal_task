/**
 * diagnostic.js — Lists all models available on your API key
 * Run: node diagnostic.js
 */
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  console.log("API Key starts with:", process.env.GEMINI_API_KEY?.slice(0, 12) + "...");
  console.log("\n── Listing available models ──\n");

  try {
    const pager = await genai.models.list();
    const models = [];
    for await (const m of pager) models.push(m);

    const flash = models.filter(m =>
      m.name && (m.name.includes("flash") || m.name.includes("pro"))
    );

    console.log("All Flash/Pro models on your key:\n");
    flash.forEach(m => {
      const methods = (m.supportedGenerationMethods || []).join(", ");
      console.log(`  ${m.name}`);
      console.log(`     displayName : ${m.displayName}`);
      console.log(`     methods     : ${methods}`);
      console.log("");
    });

    // Find first model that supports generateContent
    const usable = flash.find(m =>
      (m.supportedGenerationMethods || []).includes("generateContent")
    );
    if (usable) {
      console.log("✅ RECOMMENDED MODEL_ID to use:", usable.name.replace("models/", ""));
    }

  } catch (err) {
    console.error("Error listing models:", err.message || err);
  }

  // Quick smoke test with gemini-pro as fallback
  console.log("\n── Smoke-testing a quick generation ──\n");
  for (const candidate of [
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-001",
    "gemini-pro",
  ]) {
    try {
      const res = await genai.models.generateContent({
        model: candidate,
        contents: [{ role: "user", parts: [{ text: "Reply with just the word: OK" }] }],
      });
      console.log(`✅ ${candidate} — works! response: "${res.text?.trim()}"`);
      break;
    } catch (e) {
      console.log(`❌ ${candidate} — ${e.status || ""} ${e.message?.slice(0, 80)}`);
    }
  }
}

main();
