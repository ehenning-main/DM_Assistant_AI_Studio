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
    const response = await ai.models.generateContent({
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

    const response = await ai.models.generateContent({
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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { text: summary },
        { text: extractionPrompt }
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const cleanText = (response.text || "{}").trim().replace(/^```json/, "").replace(/```$/, "").trim();
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
    const response = await ai.models.generateContent({
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
    const { summary, notes, audioTranscription } = req.body;
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
`;

    const prompt = `
You are a master RPG chronicler and Dungeon Master scribe. Analyze the provided campaign context and detect any NPCs (Non-Player Characters) or other distinct roleplay entities that appeared or were mentioned.
For each detected NPC, extract:
1. Name (a proper name, title or clean descriptive moniker)
2. Role/Disposition (one of: "NPC Ally", "Boss Villain", "Quest Giver", "Shopkeeper", "Hero Character")
3. Brief description (1-2 sentences summarizing their appearance, role in the story, or key behavior)
4. Key RPG/D&D statistics based on their character concept in the text:
   - hp (Hit Points - a suitable number, e.g., 8 to 400 depending on power)
   - ac (Armor Class - 10 to 22)
   - alignment (e.g. "Lawful Good", "Neutral Evil", "Chaotic Neutral", "Unaligned")
   - strength (range 3-20)
   - dexterity (range 3-20)
   - constitution (range 3-20)
   - intelligence (range 3-20)
   - wisdom (range 3-20)
   - charisma (range 3-20)
   - skills_or_actions (a short 1-sentence descriptor, e.g., "Weapon attacks +5 to hit (1d8+3 dmg). Proficient in Athletics.")

You must respond with a JSON object containing a "characters" array in the exact following JSON format:
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
  ]
}

Ensure all fields are present and valid. Do not include any wordy explanations or markdown backticks around the JSON. Return only the raw JSON.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { text: docContext },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const cleanText = (response.text || "{}").trim().replace(/^```json/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleanText);
    res.json(parsed);
  } catch (error: any) {
    console.error("NPC detection error:", error);
    res.status(400).json({ error: error.message || "Failed to detect characters." });
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
