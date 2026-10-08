import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import {
  CAPTURE_TMP_ROOT,
  normalizeToSegments,
  transcodeClip,
  sweepStaleCaptureDirs,
  NormalizedManifest,
} from "./audioPipeline";
import { transcribeSegment, suggestSpeakerAssignments, TranscribeSegmentInput } from "./transcription";
import {
  detectMeetingPlatform,
  dispatchBot,
  getBotStatus,
  isMeetingBotConfigured,
  removeBotFromCall,
} from "./meetingBot";

// Capture pipeline routes.
//
// Flow for every input method:
//   1. Source audio lands on the server: chunked upload from the device (live recording or uploaded file),
//      or a download of the meeting bot's recording.
//   2. ffmpeg normalizes it into ~15 minute mono MP3 segments and writes a manifest.
//   3. The client pulls each segment once, caches it on-device, and calls /transcribe-segment, which is
//      stateless. Only steps 1-2 depend on this instance's temp disk, so a long transcription run survives
//      reloads and instance changes.

export const captureRouter = express.Router();

// Parts stay well under Cloud Run's 32 MiB request cap.
export const UPLOAD_PART_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024;

function jobDir(id: string): string {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Object.assign(new Error("Invalid job id."), { status: 400 });
  return path.join(CAPTURE_TMP_ROOT, id);
}

function newJob(meta: Record<string, unknown>): { id: string; dir: string } {
  sweepStaleCaptureDirs();
  const id = crypto.randomUUID();
  const dir = path.join(CAPTURE_TMP_ROOT, id);
  fs.mkdirSync(path.join(dir, "parts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ ...meta, createdAt: Date.now() }));
  return { id, dir };
}

function readManifest(dir: string): NormalizedManifest | null {
  const p = path.join(dir, "out", "manifest.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

function sendError(res: express.Response, error: any, fallback: string) {
  const status = typeof error?.status === "number" ? error.status : 500;
  console.error(`[capture] ${fallback}:`, error?.message || error);
  res.status(status).json({ error: error?.message || fallback });
}

async function normalizeJob(dir: string, sourcePath: string): Promise<NormalizedManifest> {
  try {
    return await normalizeToSegments(sourcePath, path.join(dir, "out"));
  } finally {
    fs.rmSync(sourcePath, { force: true });
    fs.rmSync(path.join(dir, "parts"), { recursive: true, force: true });
  }
}

// --- Chunked uploads ---------------------------------------------------------------------------------------

captureRouter.post("/uploads", (req, res) => {
  try {
    const { fileName, mimeType, sizeBytes } = req.body || {};
    if (typeof sizeBytes !== "number" || sizeBytes <= 0) {
      res.status(400).json({ error: "sizeBytes is required." });
      return;
    }
    if (sizeBytes > MAX_UPLOAD_BYTES) {
      res.status(413).json({ error: "Files larger than 4 GB are not supported." });
      return;
    }
    const { id } = newJob({ kind: "upload", fileName: String(fileName || "audio").slice(0, 200), mimeType, sizeBytes });
    res.json({ jobId: id, partSize: UPLOAD_PART_BYTES, partCount: Math.ceil(sizeBytes / UPLOAD_PART_BYTES) });
  } catch (error) {
    sendError(res, error, "Could not start upload");
  }
});

captureRouter.put(
  "/uploads/:id/parts/:index",
  express.raw({ type: () => true, limit: UPLOAD_PART_BYTES + 1024 }),
  (req, res) => {
    try {
      const dir = jobDir(req.params.id);
      const index = Number(req.params.index);
      if (!Number.isInteger(index) || index < 0 || index > 100000) {
        res.status(400).json({ error: "Invalid part index." });
        return;
      }
      if (!fs.existsSync(path.join(dir, "parts"))) {
        res.status(404).json({ error: "Upload not found on this server. Start the upload again." });
        return;
      }
      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: "Empty part." });
        return;
      }
      fs.writeFileSync(path.join(dir, "parts", String(index).padStart(6, "0")), body);
      res.json({ ok: true, index, bytes: body.length });
    } catch (error) {
      sendError(res, error, "Could not store upload part");
    }
  }
);

captureRouter.post("/uploads/:id/complete", async (req, res) => {
  try {
    const dir = jobDir(req.params.id);
    const partsDir = path.join(dir, "parts");
    const expected = Number(req.body?.partCount);
    if (!fs.existsSync(partsDir)) {
      res.status(404).json({ error: "Upload not found on this server. Start the upload again." });
      return;
    }
    const parts = fs.readdirSync(partsDir).sort();
    if (!Number.isInteger(expected) || parts.length !== expected) {
      res.status(400).json({ error: `Upload incomplete: received ${parts.length} of ${expected} parts.` });
      return;
    }
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
    const ext = path.extname(meta.fileName || "").slice(0, 8) || ".bin";
    const sourcePath = path.join(dir, `source${ext}`);
    const out = fs.createWriteStream(sourcePath);
    for (const part of parts) {
      await pipeline(fs.createReadStream(path.join(partsDir, part)), out, { end: false });
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));

    const manifest = await normalizeJob(dir, sourcePath);
    res.json({ jobId: req.params.id, manifest });
  } catch (error) {
    sendError(res, error, "Could not process the uploaded audio");
  }
});

// --- Normalized segments -----------------------------------------------------------------------------------

captureRouter.get("/jobs/:id/manifest", (req, res) => {
  try {
    const manifest = readManifest(jobDir(req.params.id));
    if (!manifest) {
      res.status(404).json({ error: "Job not found or not finished processing." });
      return;
    }
    res.json({ jobId: req.params.id, manifest });
  } catch (error) {
    sendError(res, error, "Could not read job");
  }
});

captureRouter.get("/jobs/:id/segments/:index", (req, res) => {
  try {
    const dir = jobDir(req.params.id);
    const manifest = readManifest(dir);
    const seg = manifest?.segments[Number(req.params.index)];
    if (!seg) {
      res.status(404).json({ error: "Segment not found. The server may have restarted; re-upload the recording." });
      return;
    }
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(path.join(dir, "out", seg.fileName)).pipe(res);
  } catch (error) {
    sendError(res, error, "Could not read segment");
  }
});

captureRouter.delete("/jobs/:id", (req, res) => {
  try {
    fs.rmSync(jobDir(req.params.id), { recursive: true, force: true });
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error, "Could not delete job");
  }
});

// --- Stateless processing ----------------------------------------------------------------------------------

// Transcodes (and optionally trims) a short clip, e.g. a voice-enrollment take or a speaker reference sample.
captureRouter.post("/clip", async (req, res) => {
  try {
    const { audioBase64, startSec, durationSec } = req.body || {};
    if (typeof audioBase64 !== "string" || !audioBase64) {
      res.status(400).json({ error: "audioBase64 is required." });
      return;
    }
    const input = Buffer.from(audioBase64, "base64");
    if (input.length > 30 * 1024 * 1024) {
      res.status(413).json({ error: "Clip too large." });
      return;
    }
    const mp3 = await transcodeClip(input, {
      startSec: Number(startSec) || 0,
      durationSec: Math.min(Number(durationSec) || 0, 120) || undefined,
    });
    res.json({ audioBase64: mp3.toString("base64"), mimeType: "audio/mpeg", sizeBytes: mp3.length });
  } catch (error) {
    sendError(res, error, "Could not process clip");
  }
});

captureRouter.post("/transcribe-segment", async (req, res) => {
  try {
    const body = req.body || {};
    if (typeof body.audioBase64 !== "string" || !body.audioBase64) {
      res.status(400).json({ error: "audioBase64 is required." });
      return;
    }
    if (body.mode !== "enrolled" && body.mode !== "anonymous") {
      res.status(400).json({ error: "mode must be 'enrolled' or 'anonymous'." });
      return;
    }
    const input: TranscribeSegmentInput = {
      mode: body.mode,
      audioBase64: body.audioBase64,
      mimeType: body.mimeType || "audio/mpeg",
      segmentIndex: Number(body.segmentIndex) || 0,
      totalSegments: Number(body.totalSegments) || 1,
      segmentDurationSec: Number(body.segmentDurationSec) || 900,
      references: Array.isArray(body.references) ? body.references : [],
      priorTranscriptTail: typeof body.priorTranscriptTail === "string" ? body.priorTranscriptTail.slice(-4000) : undefined,
      glossary: Array.isArray(body.glossary) ? body.glossary.map(String) : undefined,
      campaignName: typeof body.campaignName === "string" ? body.campaignName : undefined,
    };
    res.json(await transcribeSegment(input));
  } catch (error) {
    sendError(res, error, "Transcription failed");
  }
});

captureRouter.post("/suggest-speakers", async (req, res) => {
  try {
    const { speakers, players, meetingParticipants } = req.body || {};
    if (!Array.isArray(speakers) || !Array.isArray(players) || players.length === 0) {
      res.json({ suggestions: [] });
      return;
    }
    const suggestions = await suggestSpeakerAssignments({ speakers, players, meetingParticipants });
    res.json({ suggestions });
  } catch (error) {
    sendError(res, error, "Could not suggest speaker assignments");
  }
});

// --- Online sessions: meeting bot --------------------------------------------------------------------------

captureRouter.get("/bots/config", (_req, res) => {
  res.json({ enabled: isMeetingBotConfigured(), provider: "recall" });
});

captureRouter.post("/bots", async (req, res) => {
  try {
    const meetingUrl = String(req.body?.meetingUrl || "");
    const platform = detectMeetingPlatform(meetingUrl);
    if (!platform) {
      res.status(400).json({ error: "Paste a Google Meet (https://meet.google.com/...) or Zoom (https://zoom.us/j/...) link." });
      return;
    }
    if (!isMeetingBotConfigured()) {
      res.status(503).json({ error: "Online sessions are not configured on this server (RECALL_API_KEY is missing)." });
      return;
    }
    const status = await dispatchBot(meetingUrl, typeof req.body?.botName === "string" ? req.body.botName.slice(0, 60) : undefined);
    res.json({ ...status, platform });
  } catch (error) {
    sendError(res, error, "Could not dispatch the recording bot");
  }
});

captureRouter.get("/bots/:botId", async (req, res) => {
  try {
    const status = await getBotStatus(req.params.botId);
    // The provider download URL is a bearer link; keep it server-side.
    const { audioUrl, ...publicStatus } = status;
    res.json({ ...publicStatus, audioReady: !!audioUrl });
  } catch (error) {
    sendError(res, error, "Could not read bot status");
  }
});

captureRouter.post("/bots/:botId/leave", async (req, res) => {
  try {
    await removeBotFromCall(req.params.botId);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error, "Could not remove the bot from the call");
  }
});

// Downloads the bot's finished recording and normalizes it like any other upload.
captureRouter.post("/bots/:botId/ingest", async (req, res) => {
  try {
    const status = await getBotStatus(req.params.botId);
    if (!status.audioUrl) {
      res.status(409).json({ error: "The bot's recording is not ready yet.", phase: status.phase });
      return;
    }
    const { id, dir } = newJob({ kind: "bot", botId: status.botId });
    const sourcePath = path.join(dir, status.audioIsVideo ? "source.mp4" : "source.mp3");
    const download = await fetch(status.audioUrl);
    if (!download.ok || !download.body) {
      throw new Error(`Could not download the bot recording (${download.status}).`);
    }
    await pipeline(Readable.fromWeb(download.body as any), fs.createWriteStream(sourcePath));
    const manifest = await normalizeJob(dir, sourcePath);
    res.json({ jobId: id, manifest, participants: status.participants });
  } catch (error) {
    sendError(res, error, "Could not import the bot recording");
  }
});
