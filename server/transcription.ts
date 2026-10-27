import { Type } from "@google/genai";
import { generateContentWithRetry, extractJsonText } from "./gemini";

const CAPTURE_MODEL = process.env.CAPTURE_TRANSCRIBE_MODEL || "gemini-3.8-flash";

export type DiarizationMode = "enrolled" | "anonymous";

/** A known voice the model should match against: an enrolled player, or an anonymous speaker from an earlier segment. */
export interface SpeakerReference {
  key: string;
  label: string;
  role?: "GM" | "Player" | "Unknown";
  characterName?: string;
  description?: string;
  audioBase64?: string;
  mimeType?: string;
}

export interface TranscribeSegmentInput {
  mode: DiarizationMode;
  audioBase64: string;
  mimeType: string;
  segmentIndex: number;
  totalSegments: number;
  segmentDurationSec: number;
  references: SpeakerReference[];
  priorTranscriptTail?: string;
  glossary?: string[];
  campaignName?: string;
}

export interface TranscribedUtterance {
  t: number;
  speaker: string;
  text: string;
  ooc?: boolean;
}

export interface TranscribeSegmentResult {
  speakers: Array<{ key: string; description: string }>;
  utterances: TranscribedUtterance[];
}

const MAX_REFERENCE_CLIPS = 12;

const transcriptSchema = {
  type: Type.OBJECT,
  properties: {
    speakers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["key", "description"],
      },
    },
    utterances: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          t: { type: Type.NUMBER },
          speaker: { type: Type.STRING },
          text: { type: Type.STRING },
          ooc: { type: Type.BOOLEAN },
        },
        required: ["t", "speaker", "text"],
      },
    },
  },
  required: ["speakers", "utterances"],
};

function nextAnonymousKey(existing: Set<string>, prefix: string): () => string {
  let n = 1;
  return () => {
    while (existing.has(`${prefix}${n}`)) n++;
    const key = `${prefix}${n}`;
    existing.add(key);
    return key;
  };
}

export async function transcribeSegment(input: TranscribeSegmentInput): Promise<TranscribeSegmentResult> {
  const refs = input.references.slice(0, 32);
  const parts: any[] = [];

  const withAudio = refs.filter((r) => r.audioBase64).slice(0, MAX_REFERENCE_CLIPS);
  if (withAudio.length > 0) {
    parts.push({
      text: input.mode === "enrolled"
        ? "VOICE ENROLLMENT SAMPLES. Each clip below is one known person reading a short passage. Use them as voiceprints."
        : "REFERENCE CLIPS of speakers already identified earlier in this same recording. Reuse their keys when you hear the same voice.",
    });
    for (const r of withAudio) {
      parts.push({ text: `Reference clip for speaker key "${r.key}" (${r.label}):` });
      parts.push({ inlineData: { data: r.audioBase64, mimeType: r.mimeType || "audio/mpeg" } });
    }
  }

  const refLines = refs.map((r) => {
    const bits = [`key="${r.key}"`, `label="${r.label}"`];
    if (r.role) bits.push(`role=${r.role}`);
    if (r.characterName) bits.push(`plays="${r.characterName}"`);
    if (r.description) bits.push(`voice: ${r.description}`);
    if (r.audioBase64) bits.push("(has reference clip)");
    return `- ${bits.join(", ")}`;
  }).join("\n");

  const modeRules = input.mode === "enrolled"
    ? `SPEAKER LABELING (ENROLLED MODE):
- Every person at this table enrolled their voice. Attribute each utterance to the enrolled key whose voiceprint matches.
- The GM narrates, describes scenes, and voices ALL NPCs and monsters. NPC dialogue is still spoken by the GM's voice, so label it with the GM's key.
- Only if a voice clearly matches none of the enrolled samples, use a new key "U1", "U2", ... and describe it.`
    : `SPEAKER LABELING (ANONYMOUS MODE):
- You do NOT know who anyone is. Label distinct voices with keys "S1", "S2", "S3", ...
- If a voice matches a known key listed below (from earlier in this same recording), REUSE that key exactly. Keep voice identity consistent.
- New voices get the next unused number. Do not guess real names.
- One person voicing several characters (e.g. the GM doing NPC voices) is still ONE speaker key.`;

  const prompt = `You are a meticulous transcriptionist for tabletop role-playing game sessions${input.campaignName ? ` (campaign: "${input.campaignName}")` : ""}.
This is audio segment ${input.segmentIndex + 1} of ${input.totalSegments}, about ${Math.round(input.segmentDurationSec / 60)} minutes long, from a live game with several people at the table.

${modeRules}

KNOWN SPEAKER KEYS:
${refLines || "(none yet)"}

${input.glossary && input.glossary.length > 0 ? `PROPER NOUNS LIKELY TO APPEAR (use these spellings): ${input.glossary.slice(0, 80).join(", ")}\n` : ""}${input.priorTranscriptTail ? `END OF THE PREVIOUS SEGMENT'S TRANSCRIPT (for continuity only, do not repeat it):\n${input.priorTranscriptTail}\n` : ""}
TRANSCRIPTION RULES:
- Transcribe everything spoken, verbatim, in order. Do not summarize, skip, or invent dialogue.
- Start a new utterance whenever the speaker changes. Split long monologues every few sentences.
- "t" is the start time of the utterance in seconds from the START OF THIS SEGMENT (0 to ${Math.round(input.segmentDurationSec)}).
- Mark "ooc": true for out-of-character table talk (rules questions, snacks, jokes about real life). In-character speech and narration is false.
- Mark unintelligible words as [inaudible]. Omit stretches of silence or dice rolling with no speech.
- "speakers" lists every key used in this segment with a short description of the voice (pitch, accent, cadence) and what they do (narrates, plays a dwarf, etc).

Return only JSON matching the schema.`;

  parts.push({ text: "SESSION AUDIO SEGMENT:" });
  parts.push({ inlineData: { data: input.audioBase64, mimeType: input.mimeType || "audio/mpeg" } });
  parts.push({ text: prompt });

  const response = await generateContentWithRetry({
    model: CAPTURE_MODEL,
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: transcriptSchema,
      temperature: 0.2,
      maxOutputTokens: 32768,
    },
  });

  let parsed: any;
  try {
    parsed = JSON.parse(extractJsonText(response.text || "{}"));
  } catch {
    throw new Error("The transcription model returned malformed output for this segment. Retry the segment.");
  }
  return sanitizeResult(parsed, input);
}

function sanitizeResult(parsed: any, input: TranscribeSegmentInput): TranscribeSegmentResult {
  const knownKeys = new Set(input.references.map((r) => r.key));
  const speakerDesc = new Map<string, string>();
  for (const s of Array.isArray(parsed?.speakers) ? parsed.speakers : []) {
    if (s && typeof s.key === "string" && s.key.trim()) {
      speakerDesc.set(s.key.trim(), String(s.description || "").slice(0, 400));
    }
  }

  // Remap keys the model invented outside the allowed namespace (e.g. real names) to fresh anonymous keys.
  const allowedNew = input.mode === "enrolled" ? /^U\d+$/ : /^S\d+$/;
  const taken = new Set<string>([...knownKeys, ...[...speakerDesc.keys()].filter((k) => allowedNew.test(k))]);
  const mint = nextAnonymousKey(taken, input.mode === "enrolled" ? "U" : "S");
  const remap = new Map<string, string>();
  const resolveKey = (raw: string): string => {
    const k = raw.trim();
    if (knownKeys.has(k) || allowedNew.test(k)) return k;
    if (!remap.has(k)) remap.set(k, mint());
    return remap.get(k)!;
  };

  const maxT = Math.max(1, input.segmentDurationSec);
  const utterances: TranscribedUtterance[] = [];
  for (const u of Array.isArray(parsed?.utterances) ? parsed.utterances : []) {
    const text = typeof u?.text === "string" ? u.text.trim() : "";
    if (!text || typeof u?.speaker !== "string" || !u.speaker.trim()) continue;
    const t = Math.min(maxT, Math.max(0, Number(u.t) || 0));
    utterances.push({ t, speaker: resolveKey(u.speaker), text, ooc: !!u.ooc });
  }
  // Keep chronological order even if the model emitted slightly shuffled timestamps.
  utterances.sort((a, b) => a.t - b.t);

  const descByFinalKey = new Map<string, string>();
  for (const [rawKey, desc] of speakerDesc) {
    const finalKey = knownKeys.has(rawKey) || allowedNew.test(rawKey) ? rawKey : remap.get(rawKey);
    if (finalKey && !descByFinalKey.has(finalKey)) descByFinalKey.set(finalKey, desc);
  }
  const used = new Set(utterances.map((u) => u.speaker));
  const speakers = [...used].map((key) => ({ key, description: descByFinalKey.get(key) || "" }));
  return { speakers, utterances };
}

// ---------------------------------------------------------------------------------------------------------------
// Speaker-assignment suggestions for anonymous transcripts ("remember this group").

export interface SuggestSpeakerInput {
  speakers: Array<{ key: string; description?: string; sampleLines: string[]; wordCount: number; audioBase64?: string; mimeType?: string }>;
  players: Array<{
    id: string;
    name: string;
    role: "GM" | "Player";
    characterName?: string;
    voiceDescription?: string;
    sampleLines?: string[];
    audioBase64?: string;
    mimeType?: string;
  }>;
  meetingParticipants?: string[];
}

export interface SpeakerSuggestion {
  key: string;
  playerId: string | null;
  confidence: number;
  reason: string;
}

export async function suggestSpeakerAssignments(input: SuggestSpeakerInput): Promise<SpeakerSuggestion[]> {
  const parts: any[] = [];
  let clipCount = 0;
  for (const p of input.players) {
    if (p.audioBase64 && clipCount < MAX_REFERENCE_CLIPS) {
      parts.push({ text: `Known voice of player id "${p.id}" (${p.name}):` });
      parts.push({ inlineData: { data: p.audioBase64, mimeType: p.mimeType || "audio/mpeg" } });
      clipCount++;
    }
  }
  for (const s of input.speakers) {
    if (s.audioBase64 && clipCount < MAX_REFERENCE_CLIPS * 2) {
      parts.push({ text: `Sample of anonymous speaker "${s.key}" from the new recording:` });
      parts.push({ inlineData: { data: s.audioBase64, mimeType: s.mimeType || "audio/mpeg" } });
      clipCount++;
    }
  }

  const prompt = `Match anonymous speakers from a tabletop RPG session recording to the campaign's known people.

KNOWN PEOPLE:
${input.players.map((p) => `- id="${p.id}" name="${p.name}" role=${p.role}${p.characterName ? ` plays="${p.characterName}"` : ""}${p.voiceDescription ? ` voice: ${p.voiceDescription}` : ""}${p.sampleLines?.length ? `\n  things they said before: ${p.sampleLines.slice(0, 5).map((l) => JSON.stringify(l)).join(" | ")}` : ""}`).join("\n")}

ANONYMOUS SPEAKERS IN THE NEW RECORDING:
${input.speakers.map((s) => `- key="${s.key}" words=${s.wordCount}${s.description ? ` voice: ${s.description}` : ""}\n  sample lines: ${s.sampleLines.slice(0, 8).map((l) => JSON.stringify(l)).join(" | ")}`).join("\n")}
${input.meetingParticipants?.length ? `\nDisplay names seen in the video call: ${input.meetingParticipants.join(", ")}` : ""}

Use every clue: voice clips, voice descriptions, who narrates and voices NPCs (the GM usually speaks the most and describes scenes), who says "I" while acting as a particular character, people addressing each other by name.
Each known person maps to at most one speaker. Use playerId null when unsure. confidence is 0..1.
Return JSON: {"suggestions":[{"key":"S1","playerId":"...","confidence":0.8,"reason":"short reason"}]}`;
  parts.push({ text: prompt });

  const response = await generateContentWithRetry({
    model: CAPTURE_MODEL,
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                key: { type: Type.STRING },
                playerId: { type: Type.STRING, nullable: true },
                confidence: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ["key", "confidence", "reason"],
            },
          },
        },
        required: ["suggestions"],
      },
      temperature: 0.1,
    },
  });

  const parsed = JSON.parse(extractJsonText(response.text || "{}"));
  const validPlayers = new Set(input.players.map((p) => p.id));
  const validKeys = new Set(input.speakers.map((s) => s.key));
  const claimed = new Set<string>();
  const out: SpeakerSuggestion[] = [];
  const sorted = (Array.isArray(parsed?.suggestions) ? parsed.suggestions : [])
    .filter((s: any) => validKeys.has(s?.key))
    .sort((a: any, b: any) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0));
  for (const s of sorted) {
    let playerId: string | null = typeof s.playerId === "string" && validPlayers.has(s.playerId) ? s.playerId : null;
    if (playerId && claimed.has(playerId)) playerId = null;
    if (playerId) claimed.add(playerId);
    out.push({
      key: s.key,
      playerId,
      confidence: Math.max(0, Math.min(1, Number(s.confidence) || 0)),
      reason: String(s.reason || "").slice(0, 300),
    });
  }
  return out;
}
