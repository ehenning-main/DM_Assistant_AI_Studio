import { AsyncLocalStorage } from "async_hooks";
import type { RequestHandler } from "express";
import { GoogleGenAI } from "@google/genai";

const CLIENT_HTTP_OPTIONS = { headers: { "User-Agent": "aistudio-build" } };

// A user may link their own Gemini key ("AI Account" settings). The browser sends it per request in the
// x-custom-ai-key header; this request-scoped store lets every getAi() call in that request use it
// without threading the key through each route.
const requestAiKey = new AsyncLocalStorage<string | undefined>();
const CUSTOM_KEY_PATTERN = /^[A-Za-z0-9_\-]{20,128}$/;
const MAX_CACHED_CLIENTS = 50;
const customClients = new Map<string, GoogleGenAI>();

export function isPlausibleApiKey(key: unknown): key is string {
  return typeof key === "string" && CUSTOM_KEY_PATTERN.test(key);
}

export const customAiKeyMiddleware: RequestHandler = (req, _res, next) => {
  const header = req.get("x-custom-ai-key")?.trim();
  requestAiKey.run(isPlausibleApiKey(header) ? header : undefined, next);
};

export function hasCustomAiKey(): boolean {
  return !!requestAiKey.getStore();
}

// The key in effect for the current request: the user's own key if they linked one, else the server's.
export function activeApiKey(): string | undefined {
  return requestAiKey.getStore() || process.env.GEMINI_API_KEY;
}

// Lazy initialization of Google GenAI client to prevent startup crash if key is missing
let aiClient: GoogleGenAI | null = null;
export function getAi(): GoogleGenAI {
  const customKey = requestAiKey.getStore();
  if (customKey) {
    let client = customClients.get(customKey);
    if (!client) {
      if (customClients.size >= MAX_CACHED_CLIENTS) {
        customClients.delete(customClients.keys().next().value!);
      }
      client = new GoogleGenAI({ apiKey: customKey, httpOptions: CLIENT_HTTP_OPTIONS });
      customClients.set(customKey, client);
    }
    return client;
  }
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiClient = new GoogleGenAI({ apiKey, httpOptions: CLIENT_HTTP_OPTIONS });
  }
  return aiClient;
}

// Checks that a user-supplied key is accepted by the Gemini API (a cheap, quota-free model listing).
export async function verifyApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (!isPlausibleApiKey(apiKey)) {
    return { valid: false, error: "That doesn't look like a Gemini API key. Copy it from Google AI Studio > Get API key." };
  }
  try {
    const client = new GoogleGenAI({ apiKey, httpOptions: CLIENT_HTTP_OPTIONS });
    await client.models.list({ config: { pageSize: 1 } });
    return { valid: true };
  } catch (error: any) {
    const status = error?.status;
    if (status === 400 || status === 401 || status === 403) {
      return { valid: false, error: "Gemini rejected this API key. Check that it is correct and that the Generative Language API is enabled for its project." };
    }
    return { valid: false, error: `Could not reach the Gemini API to verify the key: ${error?.message || error}` };
  }
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
        if (attempt === 2) {
          currentModel = "gemini-3.1-flash-lite";
        } else if (attempt >= 3) {
          currentModel = "gemini-flash-latest";
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
