// Client for the /api/capture server routes.

export interface NormalizedSegment {
  index: number;
  fileName: string;
  startSec: number;
  endSec: number;
  sizeBytes: number;
}

export interface NormalizedManifest {
  durationSec: number;
  segmentSeconds: number;
  mimeType: string;
  segments: NormalizedSegment[];
}

export interface SpeakerReferencePayload {
  key: string;
  label: string;
  role?: "GM" | "Player" | "Unknown";
  characterName?: string;
  description?: string;
  audioBase64?: string;
  mimeType?: string;
}

export interface TranscribeSegmentResponse {
  speakers: Array<{ key: string; description: string }>;
  utterances: Array<{ t: number; speaker: string; text: string; ooc?: boolean }>;
}

export interface BotStatusResponse {
  botId: string;
  phase: "joining" | "recording" | "ended" | "ready" | "failed";
  providerStatus: string;
  endReason?: string;
  message?: string;
  audioReady?: boolean;
  participants?: string[];
  platform?: "google_meet" | "zoom";
}

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON error page
  }
  if (!res.ok) {
    const err: any = new Error(body?.error || `${fallback} (HTTP ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body as T;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      // Client errors won't succeed on retry.
      if (e?.status && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

/** Uploads a file in parts, then has the server extract and segment its audio. */
export async function uploadAndNormalize(
  file: Blob,
  fileName: string,
  onProgress?: (fraction: number, stage: "uploading" | "extracting") => void,
  signal?: AbortSignal
): Promise<{ jobId: string; manifest: NormalizedManifest }> {
  const init = await jsonOrThrow<{ jobId: string; partSize: number; partCount: number }>(
    await fetch("/api/capture/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, mimeType: file.type, sizeBytes: file.size }),
      signal,
    }),
    "Could not start upload"
  );

  for (let i = 0; i < init.partCount; i++) {
    if (signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");
    const part = file.slice(i * init.partSize, Math.min(file.size, (i + 1) * init.partSize));
    await withRetry(async () =>
      jsonOrThrow(
        await fetch(`/api/capture/uploads/${init.jobId}/parts/${i}`, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: part,
          signal,
        }),
        "Upload part failed"
      )
    );
    onProgress?.((i + 1) / init.partCount, "uploading");
  }

  onProgress?.(1, "extracting");
  return jsonOrThrow(
    await fetch(`/api/capture/uploads/${init.jobId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partCount: init.partCount }),
      signal,
    }),
    "Could not extract audio"
  );
}

export async function fetchSegment(jobId: string, index: number, signal?: AbortSignal): Promise<Blob> {
  return withRetry(async () => {
    const res = await fetch(`/api/capture/jobs/${jobId}/segments/${index}`, { signal });
    if (!res.ok) {
      const err: any = new Error(
        res.status === 404
          ? "The processing server no longer has this recording's audio. Re-run processing from the original recording."
          : `Could not download segment ${index + 1} (HTTP ${res.status})`
      );
      err.status = res.status;
      throw err;
    }
    return res.blob();
  });
}

export function releaseJob(jobId: string): void {
  fetch(`/api/capture/jobs/${jobId}`, { method: "DELETE" }).catch(() => {});
}

export async function transcodeClip(audioBase64: string, startSec?: number, durationSec?: number): Promise<{ audioBase64: string; mimeType: string }> {
  return withRetry(async () =>
    jsonOrThrow(
      await fetch("/api/capture/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, startSec, durationSec }),
      }),
      "Could not process audio clip"
    )
  );
}

export async function transcribeSegment(body: {
  mode: "enrolled" | "anonymous";
  audioBase64: string;
  mimeType: string;
  segmentIndex: number;
  totalSegments: number;
  segmentDurationSec: number;
  references: SpeakerReferencePayload[];
  priorTranscriptTail?: string;
  glossary?: string[];
  campaignName?: string;
}, signal?: AbortSignal): Promise<TranscribeSegmentResponse> {
  return withRetry(async () =>
    jsonOrThrow(
      await fetch("/api/capture/transcribe-segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      }),
      "Transcription failed"
    ), 3);
}

export async function suggestSpeakers(body: {
  speakers: Array<{ key: string; description?: string; sampleLines: string[]; wordCount: number; audioBase64?: string; mimeType?: string }>;
  players: Array<{ id: string; name: string; role: "GM" | "Player"; characterName?: string; voiceDescription?: string; sampleLines?: string[]; audioBase64?: string; mimeType?: string }>;
  meetingParticipants?: string[];
}): Promise<Array<{ key: string; playerId: string | null; confidence: number; reason: string }>> {
  const res = await jsonOrThrow<{ suggestions: any[] }>(
    await fetch("/api/capture/suggest-speakers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    "Could not suggest speakers"
  );
  return res.suggestions || [];
}

export async function getBotConfig(): Promise<{ enabled: boolean }> {
  try {
    return await jsonOrThrow(await fetch("/api/capture/bots/config"), "Bot config unavailable");
  } catch {
    return { enabled: false };
  }
}

export async function dispatchBot(meetingUrl: string): Promise<BotStatusResponse> {
  return jsonOrThrow(
    await fetch("/api/capture/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingUrl }),
    }),
    "Could not dispatch the recording bot"
  );
}

export async function getBotStatus(botId: string): Promise<BotStatusResponse> {
  return jsonOrThrow(await fetch(`/api/capture/bots/${encodeURIComponent(botId)}`), "Could not read bot status");
}

export async function removeBot(botId: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/capture/bots/${encodeURIComponent(botId)}/leave`, { method: "POST" }), "Could not remove bot");
}

export async function ingestBotRecording(botId: string): Promise<{ jobId: string; manifest: NormalizedManifest; participants?: string[] }> {
  return jsonOrThrow(
    await fetch(`/api/capture/bots/${encodeURIComponent(botId)}/ingest`, { method: "POST" }),
    "Could not import the bot recording"
  );
}

/** Mirrors the server's URL check so the GM gets instant feedback while pasting. */
export function detectMeetingPlatform(rawUrl: string): "google_meet" | "zoom" | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "meet.google.com" && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(url.pathname)) return "google_meet";
  if ((host === "zoom.us" || host.endsWith(".zoom.us")) && /^\/(j|my|w|wc\/join)\//i.test(url.pathname)) return "zoom";
  return null;
}
