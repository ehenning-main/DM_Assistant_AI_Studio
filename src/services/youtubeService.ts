import { SessionAudioItem } from "../types";
import { formatDuration } from "./audioChronologyService";

export interface YouTubeVideoInfo {
  videoId: string;
  url: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSeconds: number;
  durationFormatted: string;
  hasCaptions: boolean;
  captionSnippet?: string;
  embedUrl: string;
}

export interface YouTubeExtractedAudio {
  success: boolean;
  videoId: string;
  title: string;
  channel: string;
  durationSeconds: number;
  durationFormatted: string;
  audioData: string; // base64
  mimeType: string;
  sizeBytes: number;
  sizeStr: string;
  captions?: Array<{ text: string; offset: number; duration: number }>;
}

// Preset samples for quick demonstration and testing
export interface YouTubePreset {
  id: string;
  title: string;
  description: string;
  url: string;
  tag: string;
}

export const SAMPLE_YOUTUBE_PRESETS: YouTubePreset[] = [
  {
    id: "preset-dnd-session",
    title: "Critical Role • The Legend Begins",
    description: "Famous D&D actual-play session clip with DM narration and party dialogue",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Safe universal fallback
    tag: "Actual Play",
  },
  {
    id: "preset-tavern-brawl",
    title: "Tavern Roleplay & Encounter Clip",
    description: "Atmospheric tabletop roleplay interaction with NPC voices and combat rolls",
    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    tag: "Encounter",
  },
];

/**
 * Parses and extracts 11-character YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=XXXX
 * - https://youtu.be/XXXX
 * - https://www.youtube.com/shorts/XXXX
 * - https://www.youtube.com/embed/XXXX
 */
export function parseYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  if (match) return match[1];

  // If user pasted just the 11-char ID
  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Fetches video metadata (title, author, thumbnail, caption availability)
 */
export async function fetchYouTubeInfo(url: string): Promise<YouTubeVideoInfo> {
  const videoId = parseYouTubeVideoId(url);
  if (!videoId) {
    throw new Error("Invalid YouTube URL. Please provide a standard YouTube video or shorts link.");
  }

  const res = await fetch("/api/youtube/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({ error: "Failed to fetch YouTube details" }));
    throw new Error(errorJson.error || "Unable to retrieve YouTube video metadata.");
  }

  return await res.json();
}

/**
 * Triggers backend audio stream extraction from YouTube
 */
export async function extractYouTubeAudio(
  url: string,
  timeRange?: string
): Promise<YouTubeExtractedAudio> {
  const videoId = parseYouTubeVideoId(url);
  if (!videoId) {
    throw new Error("Invalid YouTube URL. Please provide a standard YouTube video or shorts link.");
  }

  const res = await fetch("/api/youtube/extract-audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      timeRange,
    }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({ error: "Failed to extract audio track" }));
    throw new Error(errorJson.error || "Unable to extract audio track from YouTube.");
  }

  return await res.json();
}

/**
 * Converts extracted YouTube audio into a full SessionAudioItem ready for the playlist queue
 */
export function createSessionAudioItemFromYouTube(
  info: YouTubeVideoInfo,
  extracted: YouTubeExtractedAudio,
  orderIndex: number
): SessionAudioItem {
  // Convert base64 audio to Blob for client audio playback preview
  let audioBlob: Blob | undefined;
  try {
    const byteCharacters = atob(extracted.audioData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    audioBlob = new Blob([byteArray], { type: extracted.mimeType || "audio/mp3" });
  } catch (_e) {
    // If conversion fails, keep undefined
  }

  const now = Date.now();
  const safeTitle = info.title.replace(/[^\w\s.-]/g, "").trim() || "YouTube_Audio_Track";

  return {
    id: `yt-${info.videoId}-${now}`,
    source: "youtube",
    name: `[YouTube] ${safeTitle}.mp3`,
    blob: audioBlob,
    youtubeUrl: info.url,
    youtubeVideoId: info.videoId,
    youtubeThumbnail: info.thumbnail,
    youtubeChannel: info.channel,
    captions: extracted.captions,
    sizeBytes: extracted.sizeBytes,
    sizeStr: extracted.sizeStr || `${Math.round(extracted.sizeBytes / 1024)} KB`,
    timestamp: now,
    timestampLabel: `${new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (YouTube)`,
    timestampSource: "metadata",
    estimatedDurationSeconds: extracted.durationSeconds || info.durationSeconds || 60,
    estimatedDurationStr: extracted.durationFormatted || info.durationFormatted || formatDuration(extracted.durationSeconds || 60),
    order: orderIndex + 1,
    status: "pending",
  };
}
