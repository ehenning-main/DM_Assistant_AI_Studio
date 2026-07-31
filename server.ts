import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, GenerateVideosOperation, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase body payload limit to support base64 audio and image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initialization of Google GenAI client to prevent startup crash if key is missing
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
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
async function generateContentWithRetry(params: { model: string; contents: any; config?: any }, retries = 3, delayMs = 1000): Promise<any> {
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

// Durable Image Generation helper with model fallback & Pollinations AI fallback & SVG placeholder fallback
async function generateImageWithFallback(promptString: string, aspectRatio = "1:1"): Promise<string> {
  const fullPrompt = `Fantasy RPG hand-drawn illustration style, dungeons and dragons concept art, highly detailed, atmospheric, rich vivid colors: ${promptString}`;

  // Attempt 1: Pollinations AI - fast, reliable AI image generation service returning unique RPG artwork
  try {
    const seed = Math.floor(Math.random() * 1000000);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;
    const response = await fetch(pollinationsUrl);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 1000) {
        const base64 = Buffer.from(buffer).toString("base64");
        const contentType = response.headers.get("content-type") || "image/jpeg";
        return `data:${contentType};base64,${base64}`;
      }
    }
  } catch (_err) {
    // Silent catch, try next provider
  }

  // Attempt 2: Try imagen-3.0-generate-002
  try {
    const ai = getAi();
    const imgRes = await ai.models.generateImages({
      model: "imagen-3.0-generate-002",
      prompt: fullPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: "image/png",
        aspectRatio: aspectRatio as any,
      },
    });
    if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
      return `data:image/png;base64,${imgRes.generatedImages[0].image.imageBytes}`;
    }
  } catch (_err) {
    // Silent fallback
  }

  // Attempt 3: Try gemini-2.5-flash-image
  try {
    const ai = getAi();
    const contentRes = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ text: fullPrompt }],
      config: {
        imageConfig: { aspectRatio },
      },
    });
    if (contentRes.candidates?.[0]?.content?.parts) {
      for (const part of contentRes.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (_err) {
    // Silent fallback
  }

  // Fallback 4: Dynamic atmospheric SVG card image with scene text
  const escaped = promptString.substring(0, 110).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="bgG" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#18181b"/>
        <stop offset="50%" stop-color="#09090b"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
      <linearGradient id="goldG" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bgG)"/>
    <rect x="16" y="16" width="480" height="480" fill="none" stroke="#3f3f46" stroke-width="2" rx="12"/>
    <path d="M256 90 L380 280 L132 280 Z" fill="#18181b" stroke="#f59e0b" stroke-width="2" opacity="0.6"/>
    <circle cx="256" cy="190" r="36" fill="#f59e0b" opacity="0.15"/>
    <circle cx="256" cy="190" r="12" fill="#f59e0b"/>
    <text x="256" y="360" font-family="Cinzel, Georgia, serif" font-size="18" fill="url(#goldG)" text-anchor="middle" font-weight="bold" letter-spacing="1">D&amp;D CHRONICLE ILLUSTRATION</text>
    <text x="256" y="395" font-family="sans-serif" font-size="12" fill="#a1a1aa" text-anchor="middle">${escaped}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
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

    // Use gold standards: gemini-3.6-flash for basic text and audio transcription
    const response = await generateContentWithRetry({
      model: "gemini-3.6-flash",
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
    const { title, date, notes, playerNotes, audioTranscription } = req.body;
    if (!notes && !playerNotes && !audioTranscription) {
      res.status(400).json({ error: "Please provide notes, player notes, or an audio transcription to summarize." });
      return;
    }

    const campaignContext = `
Campaign Session: ${title || "Untitled Session"}
Session Date: ${date || "N/A"}

--- DM SCRIBE NOTES (OFFICIAL DM LOGS) ---
${notes || "No DM scribe notes provided."}

--- PLAYER JOURNAL NOTES (PLAYER STASH / DIARY) ---
${playerNotes || "No player journal notes provided."}

--- AUDIO TRANSCRIPTION/LOGS ---
${audioTranscription || "No audio transcription provided."}
`;

    const prompt = `
You are a highly acclaimed, creative Dungeon Master Companion. Analyze the following campaign logs, session notes, player journals, and audio transcriptions, then synthesize them into a magnificent, organized, and deeply practical Session Chronicle.

CRITICAL RULE FOR CANON CONFLICTS / DISCREPANCIES:
1. Carefully compare [DM SCRIBE NOTES] against [PLAYER JOURNAL NOTES].
2. Trust [DM SCRIBE NOTES] over [PLAYER JOURNAL NOTES] by default for all summaries and facts.
3. If you detect ANY conflicting or differing details between DM Scribe Notes and Player Journal Notes (e.g. conflicting loot/gold amounts, magic item details, NPC fates/outcomes, battle casualties, or quest decisions):
   - You MUST add a prominent first section at the very top of your summary:

# ⚖️ CANON CONFLICTS & DISCREPANCIES DETECTED
- For each conflict found, clearly specify:
  * **Conflict Topic**: (e.g. "Gold Bounty Amount" or "Fate of Goblin Chief")
  * **DM Scribe Log Record**: (What the DM notes say)
  * **Player Journal Record**: (What the Player notes say)
  * **Default Assumption**: "Defaulting to DM Scribe Log."
  * **DM Decision Prompt**: Ask the Dungeon Master explicitly: *"Which version should be established as canonical going forward? Click 'Establish Canonical Truth' below to append your ruling permanently to this session."*

Compile the rest of your response utilizing beautiful clean Markdown formatting with the following exact structural sections:

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
      model: "gemini-3.6-flash",
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
      model: "gemini-3.6-flash",
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

    const imageUrl = await generateImageWithFallback(promptString, "1:1");
    res.json({ imageUrl });
  } catch (error: any) {
    console.error("Image generation error:", error);
    res.status(400).json({ error: error.message || "Failed to generate highlight image." });
  }
});

// 3.5. Highlight Generation with Character & Scene Continuity from Session to Session
app.post("/api/generate-continuity-illustration", async (req, res) => {
  try {
    const { summary, characters, campaignHeroes, previousHighlights } = req.body;
    if (!summary) {
      res.status(400).json({ error: "Missing campaign summary for illustration design." });
      return;
    }

    // Format all character descriptions (both party heroes and session NPCs/monsters)
    const allChars = [
      ...(Array.isArray(campaignHeroes) ? campaignHeroes : []),
      ...(Array.isArray(characters) ? characters : [])
    ];

    const charsText = allChars.length > 0
      ? allChars.map((c: any) => `- Name: ${c.name}, Class/Role: ${c.classType || c.role || "Hero/NPC"}, Race: ${c.race || "N/A"}, Appearance/Equipment/Details: ${c.description || c.notes || c.details || "N/A"}`).join("\n")
      : "No specific character details provided.";

    const prevHighlightsText = previousHighlights && Array.isArray(previousHighlights) && previousHighlights.length > 0
      ? previousHighlights.map((h: any, idx: number) => `- Previous Session Illustration ${idx + 1}: Caption: "${h.caption || "Untitled"}"${h.optimizedPrompt ? ` | Visual Prompt Used Previously: "${h.optimizedPrompt}"` : ""}`).join("\n")
      : "No previous illustration details.";

    const designPrompt = `
You are an expert RPG Visual Director and Concept Artist for D&D 5e campaigns.
We need to generate an accurate, unique, high-quality, continuity-aware visual scene for a campaign session based on its chronicle summary.

INPUT DATA:
1. SESSION CHRONICLE SUMMARY:
"${summary}"

2. ACTIVE HERO PARTY & CHARACTERS (Maintain these exact physical appearances, hair, armor, skin, weapons, and features across all session art):
${charsText}

3. PREVIOUS SESSION ARTWORK & VISUAL STYLE HISTORY (Reference these to maintain visual style and character continuity from session to session):
${prevHighlightsText}

YOUR TASK:
1. Carefully dissect the Session Chronicle Summary and choose ONE iconic, highly visual, dramatic moment (e.g., a fiery battle with a creature, finding a glowing relic in ancient ruins, a tense confrontation with an NPC, or a heroic party standoff).
2. Create a hyper-specific, highly detailed 1-paragraph visual prompt for an AI image generator.
3. CRITICAL CONTINUITY MANDATE:
   - If any character from the 'Active Hero Party & Characters' list is involved in the chosen scene, you MUST describe their physical traits (hair color/style, armor/clothes, held weapons, race, facial structure) EXACTLY as defined so their portrait remains consistent across sessions.
   - Describe the exact environment (cavern, tavern, castle, swamp, ruins), lighting (torchlight, moonlight, spell glow), mood, composition (cinematic wide-angle, dramatic low-angle), and color palette.
   - The art style MUST be: "High fantasy RPG hand-drawn illustration style, dungeons and dragons character concept art, rich vivid colors, atmospheric lighting, epic digital painting, highly detailed."
4. Provide a succinct 1-sentence caption describing the exact event portrayed in the art.

Respond with valid JSON:
{
  "optimizedPrompt": "Your detailed, continuity-aware visual prompt...",
  "chosenSceneCaption": "A concise 1-sentence caption for the generated artwork"
}
Do not include markdown backticks outside the JSON. Return raw JSON only.
`;

    // Step 1: Optimize prompt using gemini-3.6-flash
    const gResponse = await generateContentWithRetry({
      model: "gemini-3.6-flash",
      contents: [{ text: designPrompt }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const cleanText = extractJsonText(gResponse.text || "{}");
    const parsed = JSON.parse(cleanText);

    const finalImagePrompt = parsed.optimizedPrompt || `Fantasy RPG hand-drawn illustration of: ${summary.substring(0, 100)}`;
    const chosenCaption = parsed.chosenSceneCaption || "An epic chronicle moment unfolds.";

    // Step 2: Generate Image with Fallback
    const imageUrl = await generateImageWithFallback(finalImagePrompt, "1:1");
    res.json({ imageUrl, caption: chosenCaption, optimizedPrompt: finalImagePrompt });
  } catch (error: any) {
    console.error("Continuity illustration generation error:", error);
    res.status(400).json({ error: error.message || "Failed to generate continuity-aware illustration." });
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

    const operation = await getAi().models.generateVideos(videoConfig);
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
    const updated = await getAi().operations.getVideosOperation({ operation: op });

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
    const updated = await getAi().operations.getVideosOperation({ operation: op });

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
    const { summary, notes, audioTranscription, existingHeroes, previousChapterNPCs } = req.body;
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

--- PREVIOUSLY ENCOUNTERED CAMPAIGN NPCs (CRITICAL: If any detected NPC matches a name here, reuse their exact statblock, skills, and identity) ---
${previousChapterNPCs && previousChapterNPCs.length > 0
  ? previousChapterNPCs.map((n: any) => `- Name: "${n.name}", Role: "${n.role}", HP: ${n.hp}, AC: ${n.ac}, Skills/Actions: "${n.skills_or_actions || 'N/A'}", Previously in Chapters: [${(n.previousChapters || []).map((c: any) => c.title).join(", ")}]`).join("\n")
  : "No prior campaign NPCs recorded."}
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
      model: "gemini-3.6-flash",
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

// 6. DM Open Campaign Archive Search & Knowledge Oracle
app.post("/api/query-campaign", async (req, res) => {
  try {
    const { query, campaignName, campaignSetting, campaignDescription, campaignHeroes, sessions } = req.body;

    if (!query || typeof query !== "string" || !query.trim()) {
      res.status(400).json({ error: "A non-empty search query or question is required." });
      return;
    }

    const trimmedQuery = query.trim();

    // Compile comprehensive context across entire campaign chronicle archive
    let contextText = `=== CAMPAIGN WORLD OVERVIEW ===\n`;
    contextText += `Title: ${campaignName || "Untitled Campaign"}\n`;
    contextText += `Setting: ${campaignSetting || "D&D 5e"}\n`;
    contextText += `Description: ${campaignDescription || "N/A"}\n\n`;

    contextText += `=== REGISTERED PLAYER HEROES (PCs) ===\n`;
    if (campaignHeroes && campaignHeroes.length > 0) {
      campaignHeroes.forEach((h: any, idx: number) => {
        contextText += `${idx + 1}. Name: ${h.name} | Class: ${h.classType || "Hero"} | Level: ${h.level || 1} | Race: ${h.race || "N/A"} | Alignment: ${h.alignment || "N/A"} | Status: ${h.activeStatus || "Healthy"}\n`;
        if (h.magicItems && h.magicItems.length > 0) {
          contextText += `   Magic Items / Relics: ${h.magicItems.join(", ")}\n`;
        }
        if (h.history && h.history.length > 0) {
          contextText += `   Progression Milestones: ${h.history.map((mil: any) => `${mil.value} (${mil.date}): ${mil.notes}`).join(" | ")}\n`;
        }
        if (h.notes) {
          contextText += `   Lore / Player Notes: ${h.notes}\n`;
        }
      });
    } else {
      contextText += `No player characters currently registered.\n`;
    }
    contextText += `\n`;

    contextText += `=== ALL CHRONICLE CHAPTERS & SESSION NOTES (${sessions?.length || 0} Total Sessions) ===\n`;
    if (sessions && sessions.length > 0) {
      sessions.forEach((s: any, idx: number) => {
        contextText += `--- CHAPTER ${idx + 1}: "${s.title || 'Untitled Session'}" (Session ID: ${s.id}, Date: ${s.date || 'Unknown'}) ---\n`;
        if (s.summary) {
          contextText += `[AI Synthesized Summary]:\n${s.summary}\n`;
        }
        if (s.notes) {
          contextText += `[DM Scribe Notes]:\n${s.notes}\n`;
        }
        if (s.playerNotes) {
          contextText += `[Player Journal / Stash Notes]:\n${s.playerNotes}\n`;
        }
        if (s.audioTranscription) {
          contextText += `[Audio Transcription / Live Highlights]:\n${s.audioTranscription}\n`;
        }
        if (s.characters && s.characters.length > 0) {
          contextText += `[NPCs Encountered / Logged in Chapter]:\n`;
          s.characters.forEach((npc: any) => {
            contextText += `  * Name: "${npc.name}" | Role: "${npc.role}" | Description: "${npc.description || "N/A"}" | HP: ${npc.hp ?? "?"} | AC: ${npc.ac ?? "?"} | Alignment: "${npc.alignment || "N/A"}" | Skills/Actions: "${npc.skills_or_actions || "N/A"}"\n`;
          });
        }
        contextText += `\n`;
      });
    } else {
      contextText += `No session records found in the campaign archives.\n`;
    }

    const prompt = `
You are the Master Dungeon Scribe and DM Campaign Knowledge Oracle. Your task is to answer the Dungeon Master's question or search query by analyzing all session notes, session summaries, player notes, audio transcriptions, PC hero rosters, and NPC records in the campaign archive provided below.

CRITICAL DISCREPANCY & CANON RULE (DM LOGS VS PLAYER JOURNAL):
1. Carefully compare [DM Scribe Notes] against [Player Journal Notes] across the session chapters.
2. Trust [DM Scribe Notes] over [Player Journal Notes] by default when answering questions.
3. IF the user's query relates to information where [DM Scribe Notes] and [Player Journal Notes] contain conflicting or differing details (e.g. gold rewards, enemy fates, magic item owners, NPC names/outcomes, or quest goals):
   - You MUST include a prominent callout block in your response:

### ⚖️ CANON CONFLICT DETECTED
- **Conflict Area**: (Describe the topic)
- **DM Scribe Log Record**: (What the DM notes say)
- **Player Journal Record**: (What the Player notes say)
- **Default Answer**: (Provide answer based on DM Scribe Log)
- **DM Confirmation Prompt**: Ask the Dungeon Master explicitly: *"Does the DM Scribe Log reflect canonical truth, or should the Player Journal version be adopted? Click 'Establish Canonical Truth' below to choose which version to save as official canon going forward."*

GENERAL INSTRUCTIONS:
1. Provide a direct, comprehensive, and clear answer to the Dungeon Master's question.
2. Explicitly cite which Chapter titles (e.g. "Chapter 1: The Goblin Ambush") and which PCs or NPCs contain the relevant details.
3. Use markdown formatting with clear headings, bold text, and bullet points.
4. If a detail is missing or not mentioned anywhere in the archives, state that explicitly and offer a brief, logical DM suggestion or inference based on what is known.

CAMPAIGN ARCHIVE DATA:
${contextText}

DUNGEON MASTER'S QUERY:
"${trimmedQuery}"
`;

    const response = await generateContentWithRetry({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert D&D 5e Dungeon Master assistant specializing in instant campaign chronicle search and lore cross-referencing.",
        temperature: 0.3,
      },
    });

    const answerText = response.text || "No details could be extracted from the campaign archives for this query.";

    // Compute matching session IDs and character names for quick interactive badges
    const lowerQuery = trimmedQuery.toLowerCase();
    const keywords = lowerQuery.split(/\s+/).filter((k) => k.length >= 3);

    const matchingSessions: Array<{ id: string; title: string; date: string }> = [];
    const matchingCharacters: Array<{ name: string; role?: string }> = [];

    if (sessions && sessions.length > 0) {
      sessions.forEach((s: any) => {
        const textToSearch = `${s.title || ''} ${s.summary || ''} ${s.notes || ''} ${s.playerNotes || ''} ${s.audioTranscription || ''}`.toLowerCase();
        if (keywords.some((kw) => textToSearch.includes(kw))) {
          matchingSessions.push({
            id: s.id,
            title: s.title || "Untitled Chapter",
            date: s.date || "",
          });
        }
      });
    }

    if (campaignHeroes) {
      campaignHeroes.forEach((h: any) => {
        const textToSearch = `${h.name} ${h.classType || ''} ${(h.magicItems || []).join(' ')} ${h.notes || ''}`.toLowerCase();
        if (keywords.some((kw) => textToSearch.includes(kw))) {
          matchingCharacters.push({ name: h.name, role: `PC (${h.classType || 'Hero'})` });
        }
      });
    }

    if (sessions) {
      const seenNpcNames = new Set(matchingCharacters.map((c) => c.name.toLowerCase()));
      sessions.forEach((s: any) => {
        (s.characters || []).forEach((c: any) => {
          const norm = c.name.toLowerCase();
          const textToSearch = `${c.name} ${c.role || ''} ${c.description || ''} ${c.skills_or_actions || ''}`.toLowerCase();
          if (keywords.some((kw) => textToSearch.includes(kw)) && !seenNpcNames.has(norm)) {
            seenNpcNames.add(norm);
            matchingCharacters.push({ name: c.name, role: c.role || "NPC" });
          }
        });
      });
    }

    res.json({
      answer: answerText,
      query: trimmedQuery,
      matchingSessions,
      matchingCharacters,
    });
  } catch (error: any) {
    console.error("Campaign search query error:", error);
    res.status(500).json({ error: error.message || "Failed to process campaign query." });
  }
});

// Helper for D&D Beyond HTML cleaning
function cleanDndBeyondHtml(html: string): string {
  if (!html) return "";

  // Try to find raw character state JSON or Javascript declarations to prioritize
  let extractedJson = "";

  // 1. Match window.CharacterState = { ... }; or var CharacterState = { ... };
  const stateMatch = html.match(/(?:window\.)?CharacterState\s*=\s*(\{[\s\S]*?\});/i);
  if (stateMatch) {
    extractedJson += `[EXTRACTED CHARACTER STATE VARIABLE]: ${stateMatch[1].trim()}\n\n`;
  }

  // 2. Match window.characterData = { ... }; or var characterData = { ... };
  const dataMatch = html.match(/(?:window\.)?characterData\s*=\s*(\{[\s\S]*?\});/i);
  if (dataMatch) {
    extractedJson += `[EXTRACTED CHARACTER DATA VARIABLE]: ${dataMatch[1].trim()}\n\n`;
  }

  // 3. Match any script tags containing application/json or containing "character" keywords
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  while ((match = scriptRegex.exec(html)) !== null && count < 5) {
    const scriptContent = match[1].trim();
    if (
      scriptContent.includes("CharacterState") || 
      (scriptContent.includes("\"character\"") && scriptContent.includes("\"id\"") && scriptContent.includes("\"baseHitPoints\"")) ||
      (scriptContent.includes("character:") && scriptContent.includes("baseHitPoints:"))
    ) {
      extractedJson += `[EXTRACTED CHARACTER SCRIPT BLOCK ${count}]: ${scriptContent}\n\n`;
      count++;
    }
  }

  let cleaned = html;
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  cleaned = cleaned.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "");
  // We do NOT strip the <head> tag completely here because we want to preserve scripts, 
  // but we can strip heavy link/meta tags.
  cleaned = cleaned.replace(/<link\b[^>]*>/gi, "");
  cleaned = cleaned.replace(/<meta\b[^>]*>/gi, "");
  cleaned = cleaned.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "");
  cleaned = cleaned.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "");
  cleaned = cleaned.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "");
  cleaned = cleaned.replace(/class="[^"]*"/gi, "");
  cleaned = cleaned.replace(/style="[^"]*"/gi, "");
  cleaned = cleaned.replace(/\s+/g, " ");

  // Prepend any highly structure JSON characters
  if (extractedJson.trim()) {
    return (extractedJson + "\n" + cleaned).substring(0, 380000);
  }
  return cleaned.substring(0, 380000);
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

        // Check if campaign HTML is valid or a security shell
        const isCloudflare = htmlContent.includes("cloudflare") || htmlContent.includes("Cloudflare") || htmlContent.includes("Checking your browser");
        const hasCampaignData = htmlContent.includes("campaign") || htmlContent.includes("b-campaign") || htmlContent.includes("campaign-details") || htmlContent.includes("characters") || htmlContent.includes("roster");

        if (isCloudflare || !hasCampaignData) {
          console.warn("[DNDBeyond Linker] Campaign webpage fetched but appears to be a Cloudflare block, login wall, or private campaign.");
          res.json({
            fallbackNeeded: true,
            message: "Secure gate or private campaign detected. D&D Beyond campaigns are protected by credentials or Cloudflare security. Please open the campaign page in your browser, press Ctrl+U (or right-click and 'View Page Source'), copy the entire HTML, and paste it below to bypass and sync your companion roster!",
          });
          return;
        }
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

CRITICAL SAFETY AND VALIDATION DIRECTIVE:
The provided source data might be empty, truncated, generic page HTML (containing only menus, standard footer, or navigation), a Cloudflare challenge screen, or a login wall. 
If the provided source data does NOT contain recognizable, active campaign/character listings, or if it appears to be a blank SPA wrapper or Cloudflare wall, you MUST return a JSON with fallbackNeeded set to true and a descriptive message. 
DO NOT hallucinate or return the default template campaign/characters if you cannot find valid data. 

If invalid, return:
{
  "fallbackNeeded": true,
  "message": "Secure gateway, anti-scraping system, or private campaign page detected. Could not extract campaign roster. Please open the campaign webpage in your browser, press Ctrl+U (or right-click and 'View Page Source'), copy the entire HTML, and paste it below to sync everything instantly!"
}

Please extract:
1. Campaign Name (usually in a header like <h1> or within page title blocks e.g., "The Curse of Strahd").
2. Core/DM notes, descriptions, public/private notes or logs if they exist.
3. Roster of Active Characters/Heroes:
   For each character matching an active card or table row in the campaign, extract:
   - name: The proper character name (e.g., "Roland Ironheart").
   - classType: The core playable class (e.g., "Fighter", "Wizard", "Rogue", "Cleric", "Paladin", "Bard", "Druid", "Warlock", "Barbarian", "Ranger", "Monk", "Sorcerer" etc. - default to "Fighter" if omitted).
   - level: Integer level (default to 1).
   - maxHp: Max hit points integer (default to 10).
   - currentHp: Current hit points integer (default to same as maxHp, but look for a fraction or expression like "42 / 81" or "42/81" or a visual health bar state on the character row/card representing remaining hit points; if you find it, set currentHp to the numerator/remaining value e.g. 42).
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
      "currentHp": 26,
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
      model: "gemini-3.6-flash",
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

// Helper to extract character ID from D&D Beyond URL or string
function extractCharacterId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  // If it's just numbers, return it
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  // Match standard dndbeyond URL patterns
  const matches = [
    /characters\/(\d+)/i,
    /characters?=(\d+)/i,
    /ddb\.ac\/characters\/(\d+)/i,
    /profile\/[^/]+\/characters\/(\d+)/i,
    /character\/(\d+)/i
  ];
  for (const regex of matches) {
    const m = trimmed.match(regex);
    if (m && m[1]) {
      return m[1];
    }
  }
  return null;
}

// 7. D&D Beyond Individual Character Sheet Linker Endpoint
app.post("/api/parse-dndbeyond-character", async (req, res) => {
  try {
    const { characterUrl, pastedHtml } = req.body;
    let htmlContent = "";
    let directJsonData: any = null;

    const prompt = `
You are a legendary fantasy archivist and a master of D&D character sheet analytics. Your task is to inspect the provided D&D Beyond HTML character sheet source page or raw JSON and parse out vital character stats.

CRITICAL SAFETY AND VALIDATION DIRECTIVE:
The provided source data might be empty, truncated, generic page HTML (containing only menus, standard footer, or navigation), a Cloudflare challenge screen, or a login wall. 
If the provided source data does NOT contain recognizable, active character stats, or if it appears to be a blank SPA wrapper or Cloudflare wall, you MUST return a JSON with fallbackNeeded set to true and a descriptive message. 
DO NOT hallucinate or return the default template character "Roland Ironheart" if you cannot find valid data for a real character sheet. 

If invalid, return:
{
  "fallbackNeeded": true,
  "message": "Secure gateway, anti-scraping system, or private character sheet detected. Could not extract valid stats. Please open your character sheet in your browser, press Ctrl+U (or right-click and 'View Page Source'), copy the entire HTML, and paste it below to sync everything instantly!"
}

CRITICAL STATS DIRECTIVE:
We need highly accurate data. Pay special attention to:
1. name: The character name (e.g., "Roland Ironheart"). Never default to "Unknown" if there's any name mentioned in the JSON/HTML.
2. classType: The playable class (Fighter, Wizard, Rogue, Cleric, etc.).
3. subclass: The subclass specialization (Champion, Evocation, etc.).
4. race: e.g., Human, Elf, Dwarf, Halfling, Tiefling, etc.
5. level: Integer level (look under classes levels).
6. maxHp: Max hit points integer. Follow these precise rules for calculation:
   - IF RAW JSON IS PROVIDED:
     * Check "overrideHitPoints" first. If "overrideHitPoints" is set (non-null and > 0), then maxHp is exactly that value!
     * Otherwise, maxHp = baseHitPoints + bonusHitPoints + (Constitution_Modifier * Total_Character_Level) + Feat_HP_Bonus.
     * To find Constitution_Modifier: look up the Constitution base score in the "stats" array (id: 3 is Constitution). Also check "bonusStats" and "overrideStats" for id: 3, as well as modifier bonuses (under "modifiers" for "bonus-constitution-score"). The modifier value is Math.floor((Constitution_Score - 10) / 2).
     * Total_Character_Level is the sum of levels of all classes in the "classes" array.
     * Look for other flat HP feats or modifiers like Tough (which adds 2 HP per level) or Draconic Resilience (adds 1 HP per level) and add them if active.
   - IF HTML IS PROVIDED:
     * Look for text patterns like "HP 42 / 81" or "42/81" or elements with classes like "ct-health-summary__hp-max" or similar. The maximum hit points is the second/denominator value (e.g. 81).
7. currentHp: Current hit points integer. Follow these precise rules for calculation:
   - IF RAW JSON IS PROVIDED:
     * Look up "removedHitPoints" (this represents damage taken).
     * currentHp = maxHp - removedHitPoints.
     * For example, if maxHp is 81, and removedHitPoints is 39, then currentHp is 81 - 39 = 42!
     * If removedHitPoints is 0, null, or undefined, then currentHp = maxHp.
   - IF HTML IS PROVIDED:
     * Look for text patterns like "HP 42 / 81" or "42/81" or elements with classes like "ct-health-summary__hp-current" or similar. The current hit points is the first/numerator value (e.g. 42).
8. ac: Armor Class integer (look under armorClass, ac, or calculate from base + dexterity/armor stats).
9. alignment: e.g., "Chaotic Good", "Neutral", "Lawful Evil", etc.
10. passivePerception: Passive perception score (usually 10 + wisdom modifier, unless specialized).
11. stats: Extract base ability scores (usually 3-20 range, extract base values before modifiers):
   - strength (STR base score, e.g. 15)
   - dexterity (DEX base score, e.g. 14)
   - constitution (CON base score, e.g. 14)
   - intelligence (INT base score, e.g. 10)
   - wisdom (WIS base score, e.g. 12)
   - charisma (CHA base score, e.g. 8)
12. magicItems: Array of strings representing named magical items, gear, attuned attunements, or legendary relics (e.g., ["Flame Tongue Longsword", "Ring of Protection"]).
13. playerName: The name/alias of the actual user controlling them if present, or "N/A".
14. inventory: Array of inventory items (both equipped and pack items). For each item, extract:
    - name: string (e.g. "Flame Tongue Longsword")
    - description: string (any details or effects of the item)
    - quantity: number (defaults to 1)
    - equipped: boolean (true if equipped/active, false otherwise)
    - type: string (e.g. "Weapon", "Armor", "Potion", "Ring", "Wondrous Item", "Gear")
    - rarity: string (e.g. "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact")
    - isAttuned: boolean (whether attuned to the character)
15. spells: Array of spells in their spellbook or grimoire. For each spell, extract:
    - name: string (e.g. "Fireball")
    - level: number (0 for Cantrips, 1-9 for spell level)
    - school: string (e.g. "Evocation", "Abjuration")
    - description: string (concise explanation of effects/damage)
    - range: string (e.g. "120 ft", "Self", "Touch")
    - castingTime: string (e.g. "1 Action", "1 Bonus Action", "1 Reaction")
    - components: array of strings (e.g. ["V", "S", "M"])
    - duration: string (e.g. "Concentration, up to 1 minute", "Instantaneous")

If analyzing raw HTML, look for these specific class names and markup patterns:
- Character Name: Look for text inside elements with classes like "ct-character-name", "ct-character-header__name", or the main page title. Do NOT default to "Unknown" if you can find any name or heading representing the character name.
- Core Class & Level: Look for "ct-character-header__class-level", "ct-character-header__level", or "ct-character-header__class" (e.g., "Fighter 5", "Level 5 Fighter").
- Subclass: Look for "ct-character-header__subclass" or texts like "Champion", "Hexblade", "Evocation".
- Race: Look for "ct-character-header__race", "ct-character-header__race-value", or common race names (e.g. "Human", "Elf", "Dwarf", "Tiefling").
- Max HP & Current HP: Look for elements with "ct-health-summary__hp-number", "ct-health-summary__hp-current", "ct-health-summary__hp-max", or text like "HP 44 / 44" or "44/44" or "42 / 81".
- Armor Class (AC): Look for "ct-combat-summary__ac-value", "ct-combat-summary__ac", or elements labeled "Armor Class" or "AC" (e.g., 18).
- Alignment: Look for "ct-character-details__alignment", "alignment", or texts like "Neutral Good", "Chaotic Good", "Lawful Neutral".
- Ability Scores (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma): Look for "ct-ability-summary__primary-value", "ct-ability-summary__secondary-value" or labeled containers with ability score names and numbers from 3 to 20.
- Magic Items: Look for equipment listed under "ct-inventory-item" or "ct-inventory-item__name" that are marked as magic, attuned, or active, or standard D&D magic item names.
- Inventory: Scan all items listed under inventory sections, gear, equipment, weapons, and containers. Look for classes like "ct-inventory-item", descriptions, quantity.
- Spells: Scan all spells under the spells sections or spell sheets. Look for casting time, school, components, description, range, duration, and spell level.
- Player Name: Look for "ct-character-header__player-name", "player-name", or similar, or default to "N/A".

Respond with a JSON object in the exact following structure. This template is ONLY for syntax shape; you MUST populate it with the actual parsed stats:
{
  "name": "Roland Ironheart",
  "classType": "Fighter",
  "subclass": "Champion",
  "race": "Human",
  "level": 5,
  "maxHp": 44,
  "currentHp": 44,
  "ac": 18,
  "alignment": "Lawful Good",
  "passivePerception": 13,
  "strength": 16,
  "dexterity": 12,
  "constitution": 15,
  "intelligence": 10,
  "wisdom": 12,
  "charisma": 8,
  "magicItems": ["Flame Tongue Longsword"],
  "playerName": "Eric",
  "inventory": [
    {
      "name": "Flame Tongue Longsword",
      "description": "A legendary sword that deals extra fire damage.",
      "quantity": 1,
      "equipped": true,
      "type": "Weapon",
      "rarity": "Rare",
      "isAttuned": true
    },
    {
      "name": "Explorer's Pack",
      "description": "Includes a backpack, bedroll, mess kit, and tinderbox.",
      "quantity": 1,
      "equipped": false,
      "type": "Gear",
      "rarity": "Common",
      "isAttuned": false
    }
  ],
  "spells": [
    {
      "name": "Fireball",
      "level": 3,
      "school": "Evocation",
      "description": "A bright streak flashes from your pointing finger...",
      "range": "150 feet",
      "castingTime": "1 Action",
      "components": ["V", "S", "M"],
      "duration": "Instantaneous"
    }
  ]
}

Only return clean, valid, raw JSON. Do not include wordy descriptions, markdown containers, or HTML wrapper tokens.
`;

    // 1. Try fetching pristine JSON via D&D Beyond API Service first
    if (!pastedHtml || pastedHtml.trim().length === 0) {
      const charId = extractCharacterId(characterUrl);
      if (charId) {
        try {
          const apiUrl = `https://character-service.dndbeyond.com/character/v5/character/${charId}`;
          console.log(`[DNDBeyond Character Linker] Attempting official API JSON fetch: ${apiUrl}`);
          const apiResponse = await fetch(apiUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "application/json",
            }
          });

          if (apiResponse.ok) {
            const apiJson = await apiResponse.json();
            if (apiJson && apiJson.success && apiJson.data) {
              console.log(`[DNDBeyond Character Linker] Successfully fetched character JSON for: ${apiJson.data.name}`);
              directJsonData = apiJson.data;
            } else {
              console.log("[DNDBeyond Character Linker] Character data is not directly public, preparing public-only advisory response.");
              res.json({
                fallbackNeeded: true,
                message: "This character sheet is set to 'Private' on D&D Beyond. Import only works for sheets explicitly set to 'Public' by the user. Please open your character sheet on D&D Beyond, edit preferences, set character privacy to 'Public', and sync again.",
                isPrivateError: true
              });
              return;
            }
          } else {
            console.log(`[DNDBeyond Character Linker] Query response: ${apiResponse.status} (non-public or invalid profile ID)`);
            res.json({
              fallbackNeeded: true,
              message: "This character sheet is set to 'Private' or does not exist. Direct D&D Beyond URL import only works for sheets explicitly set to 'Public' by the user. Please open your character sheet on D&D Beyond, edit preferences, set character privacy to 'Public', and sync again.",
              isPrivateError: true
            });
            return;
          }
        } catch (apiErr: any) {
          console.log("[DNDBeyond Character Linker] Completed API fetch check (non-public sheet or network boundary reached)");
          res.json({
            fallbackNeeded: true,
            message: "This character sheet could not be fetched (it may be Private). Direct D&D Beyond URL import only works for sheets explicitly set to 'Public' by the user. Please make sure your D&D Beyond character sheet is explicitly set to 'Public' to be imported.",
            isPrivateError: true
          });
          return;
        }
      }
    }

    // 2. If we got JSON data, parse it directly with 100% precision!
    if (directJsonData) {
      console.log("[DNDBeyond Character Linker] Direct JSON fetched, parsing via native parser...");
      try {
        const parsedData = parseDndBeyondJson(directJsonData, "auto");
        res.json(parsedData);
        return;
      } catch (e: any) {
        console.warn("[DNDBeyond Character Linker] Native parsing failed, falling back to Gemini...", e);
        const gResponse = await generateContentWithRetry({
          model: "gemini-3.6-flash",
          contents: [
            { text: `RAW OFFICIAL CHARACTER JSON:\n${JSON.stringify(directJsonData)}` },
            { text: prompt }
          ],
          config: {
            responseMimeType: "application/json",
          }
        });

        const parsedJsonText = extractJsonText(gResponse.text || "{}");
        const parsedData = JSON.parse(parsedJsonText);
        res.json(parsedData);
        return;
      }
    }

    // 3. Fallback to scraping webpage HTML or processing Pasted HTML
    if (pastedHtml && pastedHtml.trim().length > 0) {
      htmlContent = pastedHtml;
    } else {
      if (!characterUrl) {
        res.status(400).json({ error: "Missing character URL or pasted HTML." });
        return;
      }

      try {
        console.log(`[DNDBeyond Character Linker] Scraping webpage URL: ${characterUrl}`);
        const response = await fetch(characterUrl, {
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

        // Check if fetched HTML is just Cloudflare challenge page or lacks character details
        const isCloudflare = htmlContent.includes("cloudflare") || htmlContent.includes("Cloudflare") || htmlContent.includes("Checking your browser");
        const hasCharacterData = 
          htmlContent.includes("CharacterState") || 
          htmlContent.includes("characterData") || 
          (htmlContent.includes("baseHitPoints") && htmlContent.includes("removedHitPoints")) ||
          htmlContent.includes("ct-character-name") || 
          htmlContent.includes("ct-health-summary") ||
          htmlContent.includes("character-sheet-container") ||
          (htmlContent.includes("classType") && htmlContent.includes("alignment"));

        if (isCloudflare || !hasCharacterData) {
          console.warn("[DNDBeyond Character Linker] Webpage fetched but appears to be a Cloudflare block or login shell.");
          res.json({
            fallbackNeeded: true,
            message: "Secure gateway, anti-scraping system, or private character sheet detected. D&D Beyond individual character profiles are protected. Please open your character sheet in your browser, press Ctrl+U (or right-click and 'View Page Source'), copy the entire HTML, and paste it below to sync everything instantly!",
          });
          return;
        }

      } catch (fetchErr: any) {
        console.warn("[DNDBeyond Character Linker] Web page scrape failed.", fetchErr);
        res.json({
          fallbackNeeded: true,
          message: "Scraping failed or secure gateway detected. To synchronize successfully, please open your D&D Beyond Character Sheet in your browser, View Page Source (Ctrl+U), copy all HTML, and paste it in the fall-back container below!",
        });
        return;
      }
    }

    const cleanedData = cleanDndBeyondHtml(htmlContent);

    console.log("[DNDBeyond Character Linker] Sending cleaned HTML/Extracted elements to Gemini for robust parsing...");
    const gResponse = await generateContentWithRetry({
      model: "gemini-3.6-flash",
      contents: [
        { text: `CONTEXT SOURCE DATA:\n${cleanedData}` },
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
    console.error("[DNDBeyond Character Linker] Failed to parse character:", error);
    res.status(500).json({ error: error.message || "Failed to analyze and synchronize character sheet data." });
  }
});


// --- NEW D&D BEYOND IMPORTER INTEGRATION ENDPOINTS ---

// Parse D&D Beyond API JSON response to our client-safe CharacterData
function parseDndBeyondJson(json: any, sourceType: "auto" | "pasted_json"): any {
  const data = json.data || json; // Handle wrapping or direct payload
  if (!data || (!data.name && !data.stats)) {
    throw new Error("Invalid D&D Beyond character data structure. Make sure you copy/pasted the entire JSON response.");
  }

  // 1. Name & Avatar
  const name = data.name || "Unnamed Character";
  const avatarUrl = data.avatarUrl || "";

  // 2. Race
  const race = data.race?.fullName || data.race?.baseRaceName || "Unknown Race";

  // 3. Classes & Level
  const classes = (data.classes || []).map((cls: any) => ({
    className: cls.definition?.name || "Unknown Class",
    level: cls.level || 0,
    subclass: cls.subclassDefinition?.name || undefined,
  }));
  const level = classes.reduce((sum: number, cls: any) => sum + cls.level, 0) || 1;

  // 4. Stats
  const getStatDetail = (statId: number, statName: string) => {
    const baseObj = (data.stats || []).find((s: any) => s.id === statId);
    const bonusObj = (data.bonusStats || []).find((s: any) => s.id === statId);
    const overrideObj = (data.overrideStats || []).find((s: any) => s.id === statId);

    const base = baseObj?.value || 10;
    const bonusFromStats = bonusObj?.value || 0;
    const override = overrideObj?.value || 0;

    // Scan modifiers for additional bonuses (e.g. race, feats, items)
    let modifierBonus = 0;
    let setOverrideValue = 0;
    if (data.modifiers) {
      const subTypeKey = `${statName}-score`;
      for (const group in data.modifiers) {
        if (Array.isArray(data.modifiers[group])) {
          data.modifiers[group].forEach((mod: any) => {
            if ((mod.type === "bonus" || mod.type === "ability-score-increase") && mod.subType === subTypeKey) {
              modifierBonus += mod.value || 0;
            }
            if (mod.type === "set" && mod.subType === subTypeKey) {
              setOverrideValue = Math.max(setOverrideValue, mod.value || 0);
            }
          });
        }
      }
    }

    const naturalTotal = (override > 0 ? override : base) + bonusFromStats + modifierBonus;
    const total = setOverrideValue > 0 ? Math.max(naturalTotal, setOverrideValue) : naturalTotal;
    const bonus = total - base;

    return { base, bonus, override, total };
  };

  const stats = {
    strength: getStatDetail(1, "strength"),
    dexterity: getStatDetail(2, "dexterity"),
    constitution: getStatDetail(3, "constitution"),
    intelligence: getStatDetail(4, "intelligence"),
    wisdom: getStatDetail(5, "wisdom"),
    charisma: getStatDetail(6, "charisma"),
  };

  // Con modifier calculation
  const conScore = stats.constitution.total;
  const conMod = Math.floor((conScore - 10) / 2);

  // 5. HP & Hit Point Modifiers
  const baseHp = data.baseHitPoints || 0;
  const bonusHp = data.bonusHitPoints || 0;
  const overrideHp = data.overrideHitPoints || 0;
  const removedHp = data.removedHitPoints || 0;
  const tempHp = data.temporaryHitPoints || 0;

  let hpPerLevelBonus = 0;
  let flatHpBonus = 0;

  if (data.modifiers) {
    for (const group in data.modifiers) {
      if (Array.isArray(data.modifiers[group])) {
        data.modifiers[group].forEach((mod: any) => {
          if (mod.subType === "hit-points-per-level") {
            hpPerLevelBonus += (mod.value || mod.fixedValue || 0) * level;
          } else if ((mod.subType === "hit-points" || mod.subType === "bonus-hit-points") && !mod.dice && mod.value !== null) {
            flatHpBonus += (mod.value || mod.fixedValue || 0);
          }
        });
      }
    }
  }

  let maxHp = overrideHp;
  if (!maxHp) {
    maxHp = baseHp + bonusHp + (conMod * level) + hpPerLevelBonus + flatHpBonus;
  }
  const currentHp = Math.max(0, maxHp + tempHp - removedHp);

  // Helper to strip HTML tags from parsed descriptions to avoid layout clutter
  const stripHtml = (htmlStr: string): string => {
    if (!htmlStr) return "";
    return htmlStr
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  // 6. Inventory
  const inventory = (data.inventory || []).map((item: any) => {
    const def = item.definition || {};
    return {
      name: def.name || "Unknown Item",
      description: stripHtml(def.description || def.snippet || ""),
      quantity: item.quantity || 1,
      equipped: !!item.equipped,
      type: def.filterType || def.type || "Item",
      rarity: def.rarity || "Common",
      isAttuned: !!item.isAttuned || !!item.attuned,
      weight: def.weight || 0,
    };
  });

  // Calculate AC (Armor Class) thoroughly and accurately
  const dexScore = stats.dexterity.total;
  const dexMod = Math.floor((dexScore - 10) / 2);

  let hasArmor = false;
  let armorBaseAc = 10;
  let armorDexLimit = 99; // Default: unlimited (unarmored/light armor)
  let shieldAcBonus = 0;

  if (data.inventory && Array.isArray(data.inventory)) {
    data.inventory.forEach((item: any) => {
      if (item.equipped) {
        const def = item.definition || {};
        const nameLower = (def.name || "").toLowerCase();
        const filterType = (def.filterType || "").toLowerCase();
        const armorTypeId = def.armorTypeId;
        
        const isShield = armorTypeId === 4 || filterType === "shield" || nameLower.includes("shield");
        const isArmor = [1, 2, 3].includes(armorTypeId) || filterType === "armor" || nameLower.includes("mail") || nameLower.includes("plate") || nameLower.includes("leather") || nameLower.includes("hide") || nameLower.includes("breastplate") || nameLower.includes("padded") || nameLower.includes("scale") || nameLower.includes("splint") || nameLower.includes("ring mail");

        if (isShield) {
          const baseShield = def.armorClass !== undefined ? def.armorClass : 2;
          shieldAcBonus += baseShield;
        } else if (isArmor && !isShield) {
          hasArmor = true;
          const baseClass = def.armorClass || 10;
          let limit = 99;
          
          if (armorTypeId === 2 || nameLower.includes("scale mail") || nameLower.includes("breastplate") || nameLower.includes("half plate") || nameLower.includes("hide") || nameLower.includes("chain shirt") || nameLower.includes("scale")) {
            limit = 2; // Medium armor caps Dex modifier at 2
          } else if (armorTypeId === 3 || nameLower.includes("plate") || nameLower.includes("chain mail") || nameLower.includes("splint") || nameLower.includes("ring mail")) {
            limit = 0; // Heavy armor does not add Dex modifier
          }
          
          if (baseClass > armorBaseAc) {
            armorBaseAc = baseClass;
            armorDexLimit = limit;
          }
        }
      }
    });
  }

  let unarmoredBaseAc = 10;
  if (!hasArmor) {
    if (data.modifiers) {
      for (const group in data.modifiers) {
        if (Array.isArray(data.modifiers[group])) {
          data.modifiers[group].forEach((mod: any) => {
            if (mod.type === "set" && mod.subType === "unarmored-armor-class") {
              if (mod.statId === 3) { // Constitution (Barbarian Unarmored Defense)
                const conScore = stats.constitution.total;
                const conMod = Math.floor((conScore - 10) / 2);
                unarmoredBaseAc = Math.max(unarmoredBaseAc, 10 + conMod);
              } else if (mod.statId === 5) { // Wisdom (Monk Unarmored Defense)
                const wisScore = stats.wisdom.total;
                const wisMod = Math.floor((wisScore - 10) / 2);
                unarmoredBaseAc = Math.max(unarmoredBaseAc, 10 + wisMod);
              } else if (mod.value) { // e.g. Draconic Resilience (13)
                unarmoredBaseAc = Math.max(unarmoredBaseAc, mod.value);
              }
            }
          });
        }
      }
    }
  }

  let baseAc = 10;
  if (hasArmor) {
    baseAc = armorBaseAc + Math.min(armorDexLimit, dexMod);
  } else {
    baseAc = unarmoredBaseAc + dexMod;
  }

  // Sum up all modifiers with subType === "armor-class" (e.g. Shield, Ring of Protection, Cloak of Protection, Defense Fighting Style)
  let acBonus = 0;
  let shieldBonusAlreadyInModifiers = false;
  if (data.modifiers) {
    for (const group in data.modifiers) {
      if (Array.isArray(data.modifiers[group])) {
        data.modifiers[group].forEach((mod: any) => {
          if (mod.type === "bonus" && mod.subType === "armor-class") {
            acBonus += mod.value || 0;
            // Detect if this modifier is likely from a shield to prevent double-counting
            const friendlySubName = (mod.friendlySubtypeName || "").toLowerCase();
            const friendlyName = (mod.friendlyName || "").toLowerCase();
            if (friendlySubName.includes("shield") || friendlyName.includes("shield")) {
              shieldBonusAlreadyInModifiers = true;
            }
          }
        });
      }
    }
  }

  // Add the shield bonus only if it was equipped and NOT already counted as a modifier
  if (shieldAcBonus > 0 && !shieldBonusAlreadyInModifiers) {
    baseAc += shieldAcBonus;
  }

  // Look for custom overrides/adjustments in characterValues
  let overrideAc: number | null = null;
  let adjustAc = 0;
  if (data.characterValues && Array.isArray(data.characterValues)) {
    data.characterValues.forEach((v: any) => {
      if (v.typeId === 1) { // Override Armor Class
        overrideAc = v.value;
      } else if (v.typeId === 2) { // Adjust Armor Class
        adjustAc = v.value;
      }
    });
  }

  let ac = (overrideAc !== null ? overrideAc : (baseAc + acBonus)) + adjustAc;

  // 7. Spells
  const rawSpellsList: any[] = [];

  // Class spells (import ALL spells in their spellbook / list, but tag whether prepared)
  if (Array.isArray(data.classSpells)) {
    data.classSpells.forEach((cs: any) => {
      if (Array.isArray(cs.spells)) {
        cs.spells.forEach((s: any) => {
          rawSpellsList.push({
            ...s,
            isPreparedFlag: !!s.prepared || !!s.alwaysPrepared || (s.definition && s.definition.level === 0) || cs.isLocked === true
          });
        });
      }
    });
  }

  // Race/Class/Feat/Item/etc spells inside data.spells (always active/prepared)
  if (data.spells) {
    for (const source in data.spells) {
      if (Array.isArray(data.spells[source])) {
        data.spells[source].forEach((s: any) => {
          rawSpellsList.push({
            ...s,
            isPreparedFlag: true
          });
        });
      }
    }
  }

  const spellsMap = new Map<string, any>();
  rawSpellsList.forEach((s: any) => {
    const def = s.definition || {};
    if (!def.name) return;

    let castingTime = "Action";
    if (def.activation) {
      const typeNum = def.activation.activationType;
      const timeVal = def.activation.activationTime;
      const typeMap: Record<number, string> = {
        1: "Action",
        2: "Bonus Action",
        3: "Reaction",
        4: "Minute",
        5: "Hour",
        6: "Special",
        7: "No Action",
        8: "Minute"
      };
      castingTime = `${timeVal || 1} ${typeMap[typeNum] || "Action"}`;
    }

    const components: string[] = [];
    if (Array.isArray(def.components)) {
      if (def.components.includes(1)) components.push("V");
      if (def.components.includes(2)) components.push("S");
      if (def.components.includes(3)) components.push("M");
    }

    let range = "Self";
    if (def.range) {
      range = def.range.rangeValue ? `${def.range.rangeValue} ft` : (def.range.origin || "Self");
    }

    let duration = "Instantaneous";
    if (def.duration) {
      if (def.duration.durationType === "Concentration") {
        duration = `Concentration, up to ${def.duration.durationInterval || 1} ${def.duration.durationUnit || "minute"}`;
      } else if (def.duration.durationInterval) {
        duration = `${def.duration.durationInterval} ${def.duration.durationUnit || ""}`.trim();
      } else if (def.duration.durationType) {
        duration = def.duration.durationType;
      }
    }

    spellsMap.set(def.name, {
      name: def.name,
      level: def.level || 0,
      school: (typeof def.school === "object" && def.school !== null) ? (def.school.name || "Evocation") : (def.school || "Evocation"),
      description: stripHtml(def.description || def.snippet || ""),
      range,
      castingTime,
      components,
      duration,
      prepared: !!s.isPreparedFlag,
    });
  });

  const spells = Array.from(spellsMap.values());

  const alignmentId = data.alignmentId;
  const alignmentMap: Record<number, string> = {
    1: "Lawful Good",
    2: "Neutral Good",
    3: "Chaotic Good",
    4: "Lawful Neutral",
    5: "Neutral",
    6: "Chaotic Neutral",
    7: "Lawful Evil",
    8: "Neutral Evil",
    9: "Chaotic Evil"
  };
  const alignment = alignmentMap[alignmentId] || "Neutral";

  return {
    name,
    avatarUrl,
    race,
    classes,
    classType: classes[0]?.className || "Fighter",
    subclass: classes[0]?.subclass || undefined,
    level,
    alignment,
    hp: {
      max: maxHp,
      current: currentHp,
      temp: tempHp,
    },
    maxHp,
    currentHp,
    tempHp,
    ac,
    stats,
    strength: stats.strength.total,
    dexterity: stats.dexterity.total,
    constitution: stats.constitution.total,
    intelligence: stats.intelligence.total,
    wisdom: stats.wisdom.total,
    charisma: stats.charisma.total,
    inventory,
    spells,
    magicItems: inventory
      .filter((item: any) => item.isAttuned || (item.equipped && ["uncommon", "rare", "very rare", "legendary", "artifact"].includes(item.rarity?.toLowerCase() || "")))
      .map((item: any) => item.name),
    sourceType,
    importedAt: new Date().toISOString(),
  };
}

// 1. Auto API Import Route (Proxy to dndbeyond character-service)
app.get("/api/import/auto", async (req, res) => {
  try {
    const query = req.query.query as string;
    if (!query) {
      return res.status(400).json({ error: "Missing character ID or URL" });
    }

    // Extract character ID (7 to 10 consecutive digits)
    const idMatch = query.match(/\b\d{7,10}\b/);
    if (!idMatch) {
      return res.status(400).json({ error: "Could not extract a valid 7-10 digit D&D Beyond Character ID from input. Please ensure the URL or string has your character's ID." });
    }

    const characterId = idMatch[0];
    const url = `https://character-service.dndbeyond.com/character/v5/character/${characterId}`;

    console.log(`[D&D Beyond Importer] Fetching character ${characterId} from ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`D&D Beyond returned status ${response.status}`);
    }

    const json = await response.json();
    if (json.success === false) {
      return res.status(400).json({
        error: json.message || "Failed to fetch character sheet",
        isPrivate: json.message?.toLowerCase().includes("private") || false
      });
    }

    const parsedData = parseDndBeyondJson(json, "auto");
    return res.json(parsedData);
  } catch (error: any) {
    console.error("[D&D Beyond Importer] Auto import error:", error);
    return res.status(500).json({
      error: error.message || "An error occurred while connecting to D&D Beyond. The character sheet might be private or D&D Beyond might be blocking the server."
    });
  }
});

// 2. Paste JSON Import Route
app.post("/api/import/paste-json", (req, res) => {
  try {
    const { json } = req.body;
    if (!json) {
      return res.status(400).json({ error: "Empty JSON content" });
    }

    let parsedJson;
    if (typeof json === "string") {
      parsedJson = JSON.parse(json);
    } else {
      parsedJson = json;
    }

    const parsedData = parseDndBeyondJson(parsedJson, "pasted_json");
    return res.json(parsedData);
  } catch (error: any) {
    console.error("[D&D Beyond Importer] Paste JSON parse error:", error);
    return res.status(400).json({ error: `Invalid JSON structure: ${error.message}` });
  }
});

// Schema for Gemini JSON output matching our CharacterData interface
const geminiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the character" },
    race: { type: Type.STRING, description: "Race of the character (e.g., Human, Elf, Dwarf, Tiefling)" },
    classes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          className: { type: Type.STRING, description: "The class name, e.g., Fighter, Rogue, Wizard, Cleric" },
          level: { type: Type.INTEGER, description: "Level of this class" },
          subclass: { type: Type.STRING, description: "Subclass if mentioned, e.g., Assassin, School of Evocation" },
        },
        required: ["className", "level"],
      }
    },
    level: { type: Type.INTEGER, description: "Total character level (sum of all class levels)" },
    ac: { type: Type.INTEGER, description: "Armor Class (AC) of the character, usually 10-22" },
    hp: {
      type: Type.OBJECT,
      properties: {
        max: { type: Type.INTEGER, description: "Maximum Hit Points" },
        current: { type: Type.INTEGER, description: "Current Hit Points (defaults to max)" },
        temp: { type: Type.INTEGER, description: "Temporary Hit Points (defaults to 0)" },
      },
      required: ["max", "current", "temp"]
    },
    stats: {
      type: Type.OBJECT,
      properties: {
        strength: {
          type: Type.OBJECT,
          properties: {
            base: { type: Type.INTEGER, description: "Base score (usually 3-20)" },
            bonus: { type: Type.INTEGER, description: "Racial or ASI bonuses" },
            override: { type: Type.INTEGER, description: "Override score, defaults to 0" },
            total: { type: Type.INTEGER, description: "Final combined score" }
          },
          required: ["base", "bonus", "override", "total"]
        },
        dexterity: {
          type: Type.OBJECT,
          properties: {
            base: { type: Type.INTEGER },
            bonus: { type: Type.INTEGER },
            override: { type: Type.INTEGER },
            total: { type: Type.INTEGER }
          },
          required: ["base", "bonus", "override", "total"]
        },
        constitution: {
          type: Type.OBJECT,
          properties: {
            base: { type: Type.INTEGER },
            bonus: { type: Type.INTEGER },
            override: { type: Type.INTEGER },
            total: { type: Type.INTEGER }
          },
          required: ["base", "bonus", "override", "total"]
        },
        intelligence: {
          type: Type.OBJECT,
          properties: {
            base: { type: Type.INTEGER },
            bonus: { type: Type.INTEGER },
            override: { type: Type.INTEGER },
            total: { type: Type.INTEGER }
          },
          required: ["base", "bonus", "override", "total"]
        },
        wisdom: {
          type: Type.OBJECT,
          properties: {
            base: { type: Type.INTEGER },
            bonus: { type: Type.INTEGER },
            override: { type: Type.INTEGER },
            total: { type: Type.INTEGER }
          },
          required: ["base", "bonus", "override", "total"]
        },
        charisma: {
          type: Type.OBJECT,
          properties: {
            base: { type: Type.INTEGER },
            bonus: { type: Type.INTEGER },
            override: { type: Type.INTEGER },
            total: { type: Type.INTEGER }
          },
          required: ["base", "bonus", "override", "total"]
        },
      },
      required: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]
    },
    inventory: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the item" },
          description: { type: Type.STRING, description: "Brief description of the item" },
          quantity: { type: Type.INTEGER, description: "Quantity in inventory" },
          equipped: { type: Type.BOOLEAN, description: "Whether the item is currently equipped" },
          type: { type: Type.STRING, description: "e.g., Weapon, Armor, Ring, Potion, Gear, Tool" },
          rarity: { type: Type.STRING, description: "Common, Uncommon, Rare, Very Rare, Legendary, Artifact" }
        },
        required: ["name", "description", "quantity", "equipped"]
      }
    },
    spells: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the spell" },
          level: { type: Type.INTEGER, description: "Level of the spell (0 for Cantrip, 1-9 for spell level)" },
          school: { type: Type.STRING, description: "e.g., Evocation, Abjuration, Necromancy" },
          description: { type: Type.STRING, description: "Description or effect of the spell" },
          range: { type: Type.STRING, description: "Range, e.g., 60 ft, Self, Touch, 120 ft" },
          castingTime: { type: Type.STRING, description: "Casting time, e.g., 1 Action, 1 Bonus Action, 1 Reaction" },
          components: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Spell components, e.g., V, S, M"
          }
        },
        required: ["name", "level", "description"]
      }
    }
  },
  required: ["name", "race", "classes", "level", "ac", "hp", "stats", "inventory", "spells"]
};

// 3. AI Parsing Route
app.post("/api/import/ai", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: "The provided character text is too short or empty." });
    }

    console.log("[D&D Beyond Importer] Sending pasted character sheet text to Gemini for structured extraction");

    const prompt = `Analyze the following copy-pasted text from a D&D character sheet or PDF.
Extract all relevant character information including:
1. Basic Details (Name, Race, Classes and levels)
2. Ability Scores (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma). Calculate or guess the split of base, bonus, override, and total if not explicitly stated (total is mandatory).
3. Armor Class (AC) - look for Shield, Armor, or default Dex-based calculation (usually 10-22)
4. Hit Points (Max, Current, Temp)
5. Inventory items (Name, quantity, description/effects, equipped state, item type, rarity)
6. Spells (Name, level, school, description/effects, range, casting time, V/S/M components)

Input Text:
${text}
`;

    const response = await generateContentWithRetry({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional D&D 5e mechanics parser. Extract data accurately from messy copy-pasted character sheets into the requested structured JSON. Ensure no lists are truncated. Keep item/spell descriptions concise but informative.",
        responseMimeType: "application/json",
        responseSchema: geminiResponseSchema,
      }
    });

    const parsedJson = JSON.parse(response.text.trim());
    
    // Enrich with metadata
    parsedJson.sourceType = "ai_parsed";
    parsedJson.importedAt = new Date().toISOString();

    return res.json(parsedJson);
  } catch (error: any) {
    console.error("[D&D Beyond Importer] Gemini AI parser error:", error);
    return res.status(500).json({
      error: `AI parsing failed: ${error.message || "The AI could not convert your input to standard D&D stats."}`
    });
  }
});

// Mount Vite middleware for development or serve builds in production
async function startServer() {
  try {
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
  } catch (err) {
    console.error("Failed to start server:", err);
  }
}

startServer();
