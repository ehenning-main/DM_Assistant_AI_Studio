import { GoogleGenAI } from "@google/genai";

// Lazy initialization of Google GenAI client to prevent startup crash if key is missing
let aiClient: GoogleGenAI | null = null;
export function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to perform content generation with retry logic (e.g. exponential backoff for 503/429 errors)
export async function generateContentWithRetry(params: { model: string; contents: any; config?: any }, retries = 3, delayMs = 1000): Promise<any> {
  let currentModel = params.model;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await getAi().models.generateContent({
        ...params,
        model: currentModel,
      });
    } catch (error: any) {
      const errorStr = String(error.message || error).toUpperCase();
      const isTransient = errorStr.includes("503") || 
                          errorStr.includes("UNAVAILABLE") || 
                          errorStr.includes("429") || 
                          errorStr.includes("RESOURCE EXHAUSTED") || 
                          errorStr.includes("QUOTA OUT") ||
                          errorStr.includes("QUOTA EXCEEDED") ||
                          errorStr.includes("HIGH DEMAND") ||
                          error.status === 503 ||
                          error.status === 429;
      
      if (isTransient && attempt <= retries) {
        if ((currentModel === "gemini-3.6-flash" || currentModel === "gemini-3.5-flash") && attempt === 2) {
          currentModel = "gemini-2.5-flash";
        } else if (attempt >= 3) {
          currentModel = "gemini-1.5-flash";
        }
        
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 1.5;
        continue;
      }
      throw error;
    }
  }
}

// Safely extracts a clean JSON block from raw model response text, searching for outermost curly braces
export function extractJsonText(text: string): string {
  if (!text) return "{}";
  let t = text.trim();
  // Strip common markdown code block wrappings
  t = t.replace(/^```[a-zA-Z]*\s*/, "");
  t = t.replace(/\s*```$/, "");
  t = t.trim();
  
  const firstBrace = t.indexOf("{");
  const lastBrace = t.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return t.substring(firstBrace, lastBrace + 1);
  }
  return t;
}
