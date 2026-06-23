import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase body payload limit to support base64 audio and image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Google GenAI on the server
// Utilizes process.env.GEMINI_API_KEY which is automatically injected by AI Studio
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper to perform content generation with retry logic (e.g. exponential backoff for 503/429 errors)
async function generateContentWithRetry(params: { model: string; contents: any; config?: any }, retries = 3, delayMs = 1500): Promise<any> {
  let currentModel = params.model;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await ai.models.generateContent({
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
        // As a high-durability behavior: if we fail on attempt 2 or 3 with gemini-3.5-flash,
        // we dynamically fallback to the lighter gemini-3.1-flash-lite to bypass load spikes.
        if (currentModel === "gemini-3.5-flash" && attempt >= 2) {
          console.warn(`[GEMINI API] Attempt ${attempt} failed for primary model gemini-3.5-flash. Dynamically failing back to gemini-3.1-flash-lite to clear traffic spikes...`);
          currentModel = "gemini-3.1-flash-lite";
        }
        
        console.warn(`[GEMINI API] Transient issue on attempt ${attempt} (${error.message || error}). Retrying in ${delayMs}ms using model: ${currentModel}...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2.0; // exponential backoff
        continue;
      }
      throw error;
    }
  }
}

// Safely extracts a clean JSON block from raw model response text, searching for outermost curly braces
function extractJsonText(text: string): string {
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

// API Routes

// 1. Live/Snippet Audio Transcription
app.post("/api/transcribe-audio", async (req, res) => {
  try {
    const { audioData, mimeType } = req.body;
    if (!audioData) {
      res.status(400).json({ error: "Missing transcript audio data." });
      return;
    }

    // Prepare content parts for multimodal processing
    const audioPart = {
      inlineData: {
        data: audioData,
        mimeType: mimeType || "audio/webm",
      },
    };

    const promptPart = {
      text: "You are an expert RPG Dungeon Master scribe. Play close attention to the following recorded audio snippet from a TTRPG game session. Please write a highly detailed transcription and chronicle what happened. Include key dialog, narrative descriptions, names of characters or locations mentioned, dice rolls, battle events, and any key gameplay discussions.",
    };

    // Use gold standards: gemini-3.5-flash for basic text and audio transcription
    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: { parts: [audioPart, promptPart] },
    });

    res.json({ text: response.text || "Could not transcribe audio. Snippet was silent or unparsable." });
  } catch (error: any) {
    console.error("Transcription error:", error);
    res.status(400).json({ error: error.message || "Failed to process audio snippet." });
  }
});

// 2. Automated AI Session Summarizer
app.post("/api/generate-summary", async (req, res) => {
  try {
    const { title, date, notes, audioTranscription } = req.body;
    if (!notes && !audioTranscription) {
      res.status(400).json({ error: "Please provide either notes or an audio transcription to summarize." });
      return;
    }

    const campaignContext = `
Campaign Session: ${title || "Untitled Session"}
Session Date: ${date || "N/A"}

--- WRITTEN NOTES ---
${notes || "No independent written notes provided."}

--- AUDIO TRANSCRIPTION/LOGS ---
${audioTranscription || "No audio transcription provided."}
`;

    const prompt = `
You are a highly acclaimed, creative Dungeon Master Companion. Analyze the following campaign logs, session notes, and audio transcriptions, then synthesize them into a magnificent, organized, and deeply practical Session Chronicle.

Compile your response utilizing beautiful clean Markdown formatting with the following exact structural sections:

# 📜 SESSION TITLE & CHRONICLE OVERVIEW
*Create an immersive, themed, evocative title for this chapter of the chronicle, followed by a theatrical 2-3 paragraph atmospheric overview of the session's overall progress and major themes.*

# ⚔️ CAMPAIGN KEY HIGHLIGHTS
*Detail the 3-5 most critical events, conflicts, combat results, puzzles solved, or legendary feats in highly engaging bullet points.*

# 👥 KEY CHARACTERS & DEAR NPCs
*Inventory the active party members, key allies, villains, or shopkeepers encountered during this session, summarizing their disposition, objectives, or items acquired.*

# 🗝️ THREADS, SECRETS & CLUES
*Detail any mysteries proposed, map-clues discovered, unresolved plot hooks, or side-quest prompts that the DM can leverage in future sessions.*

# 🎒 LOOT & DICE TALES
*Summarize any significant gold, magic items, weapons, or key rewards claimed, along with any memorable natural 20s, critical failures, or legendary battle statistics.*
`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: [
        { text: campaignContext },
        { text: prompt }
      ],
    });

    res.json({ summary: response.text });
  } catch (error: any) {
    console.error("Summary generation error:", error);
    res.status(400).json({ error: error.message || "Failed to generate campaign summary." });
  }
});

// Extra: Extract Cinematic Art & Video prompts from Chronicle Summary
app.post("/api/extract-media-prompts", async (req, res) => {
  try {
    const { summary } = req.body;
    if (!summary) {
      res.status(400).json({ error: "Missing campaign summary for media analysis." });
      return;
    }

    const extractionPrompt = `
You are a master cinematic RPG visual director. Analyze the following Campaign Chronicle Summary and devise:
1. Two to Three (2-3) separate, highly descriptive fantasy illustration prompt concepts. Each concept should represent a critical and visually impactful moment, boss encounter, legendary loot, or scenic dungeon backdrop mentioned in the summary.
2. One (1) separate dramatic video prompt concept that describes direct visual motion, camera angles, and atmospheric conditions style, suitable for a cinematic camera or video generator.

The prompts must be highly detailed, immersive, and styled for dark fantasy concept art. Keep the wording rich but highly physical for an image/video generator.

You must respond with valid string arrays in the exact following JSON format:
{
  "imagePrompts": [
    "highly detailed description of visual moment #1",
    "highly detailed description of visual moment #2",
    "highly detailed description of visual moment #3"
  ],
  "videoPrompt": "highly detailed dramatic motion camera direction video concept"
}
Do not include any wordy explanations or markdown backticks around the JSON. Return only the raw JSON.
`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: [
        { text: summary },
        { text: extractionPrompt }
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const cleanText = extractJsonText(response.text || "{}");
    const parsed = JSON.parse(cleanText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Error extracting media prompts:", error);
    res.status(400).json({ error: error.message || "Failed to extract highlights prompts." });
  }
});

// 3. Highlight Static Image Generation
app.post("/api/generate-highlight", async (req, res) => {
  try {
    const { promptString } = req.body;
    if (!promptString) {
      res.status(400).json({ error: "Please provide a description prompt for the highlight image." });
      return;
    }

    // Use gold standards: gemini-2.5-flash-image for general image tasks
    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: `Fantasy RPG hand-drawn illustration style, dungeons and dragons character/item/event concept art. Highly detailed, rich colors, atmospheric: ${promptString}`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    let base64Image = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("No image data returned from image generation model.");
    }

    const imageUrl = `data:image/png;base64,${base64Image}`;
    res.json({ imageUrl });
  } catch (error: any) {
    console.error("Image generation error:", error);
    res.status(400).json({ error: error.message || "Failed to generate highlight image." });
  }
});

// 4. Video Generation 3-step Veo flow
// Step 4.1: Start Video Generation
app.post("/api/generate-video", async (req, res) => {
  try {
    const { promptString, startImageBase64, mimeType } = req.body;
    if (!promptString) {
      res.status(400).json({ error: "Missing video generation description." });
      return;
    }

    const videoConfig: any = {
      model: "veo-3.1-lite-generate-preview",
      prompt: `Cinematic fantasy RPG epic moment, realistic lighting, gorgeous 3D render: ${promptString}`,
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: "16:9",
      },
    };

    if (startImageBase64) {
      videoConfig.image = {
        imageBytes: startImageBase64,
        mimeType: mimeType || "image/png",
      };
    }

    const operation = await ai.models.generateVideos(videoConfig);
    res.json({ operationName: operation.name });
  } catch (error: any) {
    console.error("Video generation start fail:", error);
    res.status(400).json({ error: error.message || "Failed to launch video generation." });
  }
});

// Step 4.2: Poll Status of Video Generation
app.post("/api/video-status", async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      res.status(400).json({ error: "Missing video operation name." });
      return;
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    res.json({
      done: updated.done || false,
      error: updated.error || null,
    });
  } catch (error: any) {
    console.error("Video polling error:", error);
    res.status(400).json({ error: error.message || "Failed to query video generation status." });
  }
});

// Step 4.3: Download and Stream Video Bytes
app.post("/api/video-download", async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      res.status(400).json({ error: "Missing video operation name." });
      return;
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      res.status(400).json({ error: "Video URI not available in operation response." });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "Server API key missing." });
      return;
    }

    const videoRes = await fetch(uri, {
      headers: { "x-goog-api-key": apiKey },
    });

    if (!videoRes.ok) {
      throw new Error(`Failed to stream video from Google cloud repository: ${videoRes.statusText}`);
    }

    res.setHeader("Content-Type", "video/mp4");
    
    // Pipe response body stream to the express response
    const reader = videoRes.body?.getReader();
    if (!reader) {
      throw new Error("Unable to read video from stream source.");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (error: any) {
    console.error("Video downloading fail:", error);
    res.status(400).json({ error: error.message || "Exception occurred during streaming." });
  }
});

// 5. Automated NPC Detection from Chronicle / Transcription
app.post("/api/detect-npcs", async (req, res) => {
  try {
    const { summary, notes, audioTranscription, existingHeroes } = req.body;
    if (!summary && !notes && !audioTranscription) {
      res.status(400).json({ error: "No campaign text, summaries, or transcriptions provided to analyze NPC souls." });
      return;
    }

    const docContext = `
--- CAMPAIGN SUMMARY ---
${summary || "N/A"}

--- SESSION NOTES ---
${notes || "N/A"}

--- TRANSCRIPTION LOG ---
${audioTranscription || "N/A"}

--- EXISTING PLAYER HEROES ---
${existingHeroes && existingHeroes.length > 0 
  ? existingHeroes.map((h: any) => `- Name: ${h.name}, Level: ${h.level}, Magic Items: [${(h.magicItems || []).join(", ")}]`).join("\n")
  : "None recorded yet."}
`;

    const prompt = `
You are a master RPG chronicler and Dungeon Master scribe. Analyze the provided campaign context to detect:
1. NPCs (Non-Player Characters) or other distinct roleplay entities that appeared or were mentioned.
2. PC/Hero Updates (Updates to any of the matching EXISTING PLAYER HEROES mentioned above, e.g. if the text mentions they leveled up, gained a level, or obtained / found / attuned to a specific magic item / legendary relic).
3. New Heroes (Any player characters / heroes that have joined the party but are NOT on the existing player heroes list).

For each detected NPC, extract:
- Name (a proper name, title or clean descriptive moniker)
- Role/Disposition (one of: "NPC Ally", "Boss Villain", "Quest Giver", "Shopkeeper")
- Brief description (1-2 sentences summarizing their appearance, role in the story, or key behavior)
- Key RPG/D&D statistics based on their character concept:
  - hp (Hit Points - a suitable number, e.g., 8 to 400 depending on power)
  - ac (Armor Class - 10 to 22)
  - alignment (e.g. "Lawful Good", "Neutral Evil", "Chaotic Neutral", "Unaligned")
  - strength, dexterity, constitution, intelligence, wisdom, charisma (range 3-20)
  - skills_or_actions (a short 1-sentence descriptor, e.g., "Weapon attacks +5 to hit (1d8+3 dmg). Proficient in Athletics.")

For each PC/Hero Update (ONLY for names matching those in the EXISTING PLAYER HEROES list):
- heroName: The exact name of the existing hero.
- type: Either "level" (if they leveled up or reached a new level) or "magic_item" (if they acquired/found a new magical item/relic).
- value: e.g., "Level 5" (if level) or the name of the acquired magic item (e.g., "Flame Tongue Longsword").
- notes: A short explanation (1 sentence) summarizing how/where they achieved this level-up or found this treasure in the session notes.

For each New Hero (playable companion character NOT on the existing heroes list but who joined the quest or party):
- name (proper character name)
- classType (suitable D&D class e.g. Fighter, Wizard, Rogue, Cleric, Paladin, Bard, Druid, Warlock, Barbarian, Ranger, Monk)
- level (suitable starting level mentioned, defaults to 1)
- maxHp (Hit points matching level and class)
- ac (Armor class based on class/gear, e.g. 12-18)
- alignment (e.g. "Neutral Good", "Chaotic Good", "Neutral")
- strength, dexterity, constitution, intelligence, wisdom, charisma (range 3-20)
- magicItems (array of string names of magic items they start with, if any)

You must respond with a JSON object containing characters, heroUpdates, and newHeroes in the exact following JSON format:
{
  "characters": [
    {
      "name": "NPC Name",
      "role": "NPC Ally",
      "description": "Short description of the NPC.",
      "hp": 45,
      "ac": 15,
      "alignment": "Neutral Good",
      "strength": 14,
      "dexterity": 12,
      "constitution": 14,
      "intelligence": 10,
      "wisdom": 11,
      "charisma": 8,
      "skills_or_actions": "Shortsword attack +4 (1d6+2 piercing)."
    }
  ],
  "heroUpdates": [
    {
      "heroName": "Roland Ironheart",
      "type": "level",
      "value": "Level 6",
      "notes": "Leveled up after slaying the fire giant in the cave."
    },
    {
      "heroName": "Aurelia",
      "type": "magic_item",
      "value": "Staff of Power",
      "notes": "Retrieved from the high wizard's vault in the academy."
    }
  ],
  "newHeroes": [
    {
      "name": "Eldrin the Mage",
      "classType": "Wizard",
      "level": 5,
      "maxHp": 28,
      "ac": 12,
      "alignment": "Neutral Good",
      "strength": 8,
      "dexterity": 14,
      "constitution": 12,
      "intelligence": 16,
      "wisdom": 14,
      "charisma": 11,
      "magicItems": ["Amulet of Health"]
    }
  ]
}

Ensure all fields are present and valid. Do not include wordy explanations or markdown backticks around the JSON. Return only raw JSON.
`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: [
        { text: docContext },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const cleanText = extractJsonText(response.text || "{}");
    const parsed = JSON.parse(cleanText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Character detection error:", error);
    res.status(400).json({ error: error.message || "Failed to detect characters." });
  }
});

// Helper for D&D Beyond HTML cleaning
function cleanDndBeyondHtml(html: string): string {
  if (!html) return "";
  let cleaned = html;
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  cleaned = cleaned.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "");
  cleaned = cleaned.replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, "");
  cleaned = cleaned.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "");
  cleaned = cleaned.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "");
  cleaned = cleaned.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "");
  cleaned = cleaned.replace(/class="[^"]*"/gi, "");
  cleaned = cleaned.replace(/style="[^"]*"/gi, "");
  cleaned = cleaned.replace(/\s+/g, " ");
  return cleaned.substring(0, 350000); // reasonable token limit safety cap
}

// 6. D&D Beyond Campaign Linker Endpoint
app.post("/api/parse-dndbeyond", async (req, res) => {
  try {
    const { campaignUrl, pastedHtml } = req.body;
    let htmlContent = "";

    if (pastedHtml && pastedHtml.trim().length > 0) {
      htmlContent = pastedHtml;
    } else {
      if (!campaignUrl) {
        res.status(400).json({ error: "Missing campaign URL or pasted HTML." });
        return;
      }

      try {
        console.log(`[DNDBeyond Linker] Fetching campaign URL: ${campaignUrl}`);
        const response = await fetch(campaignUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP status ${response.status}`);
        }

        htmlContent = await response.text();
      } catch (fetchErr: any) {
        console.warn("[DNDBeyond Linker] Direct scrape failed. It likely requires authentication or is blocked.", fetchErr);
        // Fallback: Signal to the client to ask the user to paste the D&D Beyond page source!
        res.json({
          fallbackNeeded: true,
          message: "Secure gate detected. D&D Beyond campaigns are protected by credentials or Cloudflare security. Please paste the campaign's page source HTML to bypass and sync your companion roster!",
        });
        return;
      }
    }

    const cleanedData = cleanDndBeyondHtml(htmlContent);

    const prompt = `
You are a legendary fantasy archivist and a master of D&D character sheet analytics. Your task is to inspect the provided D&D Beyond HTML campaign page source and parse out vital metadata and companion/hero statistics.

Please extract:
1. Campaign Name (usually in a header like <h1> or within page title blocks e.g., "The Curse of Strahd").
2. Core/DM notes, descriptions, public/private notes or logs if they exist.
3. Roster of Active Characters/Heroes:
   For each character matching an active card or table row in the campaign, extract:
   - name: The proper character name (e.g., "Roland Ironheart").
   - classType: The core playable class (e.g., "Fighter", "Wizard", "Rogue", "Cleric", "Paladin", "Bard", "Druid", "Warlock", "Barbarian", "Ranger", "Monk", "Sorcerer" etc. - default to "Fighter" if omitted).
   - level: Integer level (default to 1).
   - maxHp: Max hit points integer (default to 10).
   - ac: Armor Class integer (default to 10).
   - alignment: e.g., "Chaotic Good", "Neutral", "Lawful Evil", etc.
   - stats (strength, dexterity, constitution, intelligence, wisdom, charisma): Integer values range 3-20. If missing or undefined, estimate fitting hero stats suitable to their class and level.
   - magicItems: Array of strings representing named magical items, gear, attuned attunements, or legendary relics (e.g., ["Flame Tongue Longsword", "Ring of Protection"]).
   - playerName: The name of the actual user controlling them (e.g., "Eric", "Dave"), if present, or "N/A".

Respond with a JSON object in the exact following structure:
{
  "campaignName": "The Lost Mines of Phandelver",
  "description": "Short description of the campaign context or campaign metadata if found.",
  "notes": "Any public notes, logs, or descriptions written by the DM in the logs, or 'N/A' if empty.",
  "characters": [
    {
      "name": "Aurelia",
      "classType": "Wizard",
      "level": 4,
      "maxHp": 26,
      "ac": 12,
      "alignment": "Neutral Good",
      "strength": 8,
      "dexterity": 14,
      "constitution": 12,
      "intelligence": 16,
      "wisdom": 14,
      "charisma": 11,
      "magicItems": ["Wand of Magic Missiles"],
      "playerName": "Emily"
    }
  ]
}

Only return clean, valid, raw JSON. Do not include wordy descriptions, markdown containers, or HTML wrapper tokens.
`;

    console.log("[DNDBeyond Linker] Sending cleaned HTML to Gemini for robust analytics...");
    const gResponse = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: [
        { text: `CONTEXT SOURCE HTML:\n${cleanedData}` },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const parsedJsonText = extractJsonText(gResponse.text || "{}");
    const parsedData = JSON.parse(parsedJsonText);
    res.json(parsedData);

  } catch (error: any) {
    console.error("[DNDBeyond Linker] Failed to parse dndbeyond page:", error);
    res.status(500).json({ error: error.message || "Failed to analyze and synchronize campaign data." });
  }
});

// Mount Vite middleware for development or serve builds in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dungeon Master Companion backend online on port: ${PORT}`);
  });
}

startServer();
