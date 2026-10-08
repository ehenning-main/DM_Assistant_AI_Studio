// "Saga Scribe Bot" dispatch for online sessions (Google Meet / Zoom).
//
// Joining a call as a participant requires a meeting-bot service; this module wraps Recall.ai's
// bot API (https://docs.recall.ai). Configure with:
//   RECALL_API_KEY   – required to enable online sessions
//   RECALL_REGION    – us-east-1 (default), us-west-2, eu-central-1, ap-northeast-1
//   SAGASCRIBE_BOT_NAME – display name in the call (default "SagaScribe-Recorder")
//
// The bot records mixed call audio and leaves automatically when everyone else has left. When it is kicked
// or leaves, its status moves to call_ended -> done, at which point the mixed audio becomes downloadable.

export type MeetingPlatform = "google_meet" | "zoom";

export type BotPhase =
  | "joining"        // dispatched, connecting / in waiting room
  | "recording"      // in the call and capturing audio
  | "ended"          // left the call, recording is being finalized by the provider
  | "ready"          // audio is available for download
  | "failed";

export interface BotStatus {
  botId: string;
  phase: BotPhase;
  providerStatus: string;
  endReason?: string;
  message?: string;
  audioUrl?: string;
  audioIsVideo?: boolean;
  participants?: string[];
}

export function detectMeetingPlatform(rawUrl: string): MeetingPlatform | null {
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

export function isMeetingBotConfigured(): boolean {
  return !!process.env.RECALL_API_KEY;
}

function recallBase(): string {
  const region = process.env.RECALL_REGION || "us-east-1";
  return `https://${region}.recall.ai/api/v1`;
}

async function recallFetch(pathName: string, init: RequestInit = {}): Promise<any> {
  const key = process.env.RECALL_API_KEY;
  if (!key) throw new Error("Online sessions are not configured: set RECALL_API_KEY on the server.");
  const res = await fetch(`${recallBase()}${pathName}`, {
    ...init,
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const detail = body?.detail || body?.message || body?.raw || res.statusText;
    throw new Error(`Meeting bot provider error (${res.status}): ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
  return body;
}

export async function dispatchBot(meetingUrl: string, botName?: string): Promise<BotStatus> {
  const body = {
    meeting_url: meetingUrl.trim(),
    bot_name: botName || process.env.SAGASCRIBE_BOT_NAME || "SagaScribe-Recorder",
    recording_config: {
      audio_mixed_mp3: {},
    },
    automatic_leave: {
      // Leave (and finish the recording) shortly after the bot is the last one in the call.
      everyone_left_timeout: { timeout: 30 },
      waiting_room_timeout: 1200,
      noone_joined_timeout: 1200,
    },
  };
  const bot = await recallFetch("/bot/", { method: "POST", body: JSON.stringify(body) });
  return toBotStatus(bot);
}

export async function getBotStatus(botId: string): Promise<BotStatus> {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(botId)) throw new Error("Invalid bot id.");
  const bot = await recallFetch(`/bot/${botId}/`);
  return toBotStatus(bot);
}

export async function removeBotFromCall(botId: string): Promise<void> {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(botId)) throw new Error("Invalid bot id.");
  await recallFetch(`/bot/${botId}/leave_call/`, { method: "POST" });
}

function toBotStatus(bot: any): BotStatus {
  const changes: any[] = Array.isArray(bot?.status_changes) ? bot.status_changes : [];
  const last = changes[changes.length - 1] || bot?.status || {};
  const code: string = last.code || "joining_call";
  const endChange = [...changes].reverse().find((c) => c.code === "call_ended");

  const recordings: any[] = Array.isArray(bot?.recordings) ? bot.recordings : [];
  let audioUrl: string | undefined;
  let audioIsVideo = false;
  for (const rec of recordings) {
    const shortcuts = rec?.media_shortcuts || {};
    const audio = shortcuts.audio_mixed?.data?.download_url;
    if (audio) {
      audioUrl = audio;
      break;
    }
    const video = shortcuts.video_mixed?.data?.download_url;
    if (video && !audioUrl) {
      audioUrl = video;
      audioIsVideo = true;
    }
  }

  let phase: BotPhase;
  if (code === "fatal") phase = "failed";
  else if (code === "done" || code === "analysis_done") phase = audioUrl ? "ready" : "ended";
  else if (code === "call_ended" || code === "recording_done") phase = "ended";
  else if (code === "in_call_recording") phase = "recording";
  else phase = "joining";

  const participants = Array.isArray(bot?.meeting_participants)
    ? bot.meeting_participants.map((p: any) => p?.name).filter(Boolean)
    : undefined;

  return {
    botId: String(bot?.id || ""),
    phase,
    providerStatus: code,
    endReason: endChange?.sub_code || (code === "fatal" ? last.sub_code : undefined),
    message: last.message || undefined,
    audioUrl,
    audioIsVideo,
    participants,
  };
}
