// Pure helpers for speaker-identified transcripts: display names, text export, and conversion to the
// AudioSessionAnalysis shape the rest of the app (chronicle synthesis, audio notes view) already consumes.

import { AudioSessionAnalysis, AudioSpeaker, CampaignPlayer, CaptureSpeaker, SessionCapture, TranscriptLine } from "../types";

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "Speaker 1" for anonymous keys, "Unrecognized voice 1" for voices that matched no enrollment. */
export function anonymousLabel(key: string): string {
  const s = /^S(\d+)$/.exec(key);
  if (s) return `Speaker ${s[1]}`;
  const u = /^U(\d+)$/.exec(key);
  if (u) return `Unrecognized voice ${u[1]}`;
  return key;
}

export function playerDisplayName(player: CampaignPlayer): string {
  return player.role === "GM" ? "GM" : player.name;
}

export function speakerName(speaker: CaptureSpeaker | undefined, key: string, players: CampaignPlayer[]): string {
  const playerId = speaker?.playerId ?? (players.some((p) => p.id === key) ? key : null);
  const player = playerId ? players.find((p) => p.id === playerId) : undefined;
  return player ? playerDisplayName(player) : anonymousLabel(key);
}

export function buildSpeakerNameMap(capture: SessionCapture, players: CampaignPlayer[]): Map<string, string> {
  const map = new Map<string, string>();
  const keys = new Set<string>([...capture.speakers.map((s) => s.key), ...capture.lines.map((l) => l.s)]);
  for (const key of keys) {
    map.set(key, speakerName(capture.speakers.find((s) => s.key === key), key, players));
  }
  return map;
}

/** Plain-text transcript: [00:12:03] GM: "You see a door." */
export function formatTranscriptText(
  capture: SessionCapture,
  players: CampaignPlayer[],
  lines: TranscriptLine[] = capture.lines,
  opts: { timestamps?: boolean; markOoc?: boolean } = { timestamps: true, markOoc: true }
): string {
  const names = buildSpeakerNameMap(capture, players);
  return lines
    .map(({ t, s: key, x: text, o: ooc }) => {
      const stamp = opts.timestamps ? `[${formatClock(t)}] ` : "";
      const tag = opts.markOoc && ooc ? " (OOC)" : "";
      return `${stamp}${names.get(key) || anonymousLabel(key)}${tag}: "${text}"`;
    })
    .join("\n");
}

export function formatTranscriptMarkdown(title: string, date: string, capture: SessionCapture, players: CampaignPlayer[], lines: TranscriptLine[] = capture.lines): string {
  const names = buildSpeakerNameMap(capture, players);
  const header = [
    `# ${title}`,
    "",
    `- **Date:** ${date}`,
    `- **Source:** ${capture.method === "live" ? "Live table recording" : capture.method === "online" ? "Online session (meeting bot)" : "Uploaded recording"}`,
    capture.durationSec ? `- **Length:** ${formatClock(capture.durationSec)}` : "",
    `- **Speakers:** ${[...new Set(names.values())].join(", ")}`,
    "",
    "---",
    "",
  ].filter((l) => l !== "");
  const body = lines.map(({ t, s: key, x: text, o: ooc }) => `**${names.get(key) || anonymousLabel(key)}**${ooc ? " _(OOC)_" : ""} \`${formatClock(t)}\`  \n${text}\n`);
  return [...header, "", ...body].join("\n");
}

export interface SpeakerStats {
  key: string;
  lineCount: number;
  wordCount: number;
  sampleLines: string[];
  firstAt: number;
}

export function computeSpeakerStats(lines: TranscriptLine[]): Map<string, SpeakerStats> {
  const stats = new Map<string, SpeakerStats>();
  for (const { t, s: key, x: text } of lines) {
    let s = stats.get(key);
    if (!s) {
      s = { key, lineCount: 0, wordCount: 0, sampleLines: [], firstAt: t };
      stats.set(key, s);
    }
    s.lineCount++;
    s.wordCount += text.split(/\s+/).filter(Boolean).length;
  }
  // Sample lines: the longest few, which carry the most identifying content (names, "I attack...").
  const byKey = new Map<string, string[]>();
  for (const { s: key, x: text } of lines) {
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(text);
  }
  for (const [key, texts] of byKey) {
    stats.get(key)!.sampleLines = [...texts].sort((a, b) => b.length - a.length).slice(0, 8);
  }
  return stats;
}

/**
 * Picks a clean stretch of a speaker's voice for playback / reference clips: an utterance followed by a gap
 * before the next speaker, so the clip is mostly that one voice.
 */
export function pickVoiceSample(lines: TranscriptLine[], key: string, segmentEndSec?: number): { startSec: number; durationSec: number } | null {
  let best: { startSec: number; durationSec: number; score: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].s !== key) continue;
    const start = lines[i].t;
    // Extend through consecutive lines by the same speaker.
    let j = i;
    while (j + 1 < lines.length && lines[j + 1].s === key) j++;
    const end = j + 1 < lines.length ? lines[j + 1].t : segmentEndSec ?? start + 10;
    const dur = Math.min(15, Math.max(0, end - start));
    const words = lines.slice(i, j + 1).reduce((n, l) => n + l.x.split(/\s+/).length, 0);
    const score = Math.min(dur, 12) + Math.min(words, 30) / 10;
    if (dur >= 3 && (!best || score > best.score)) best = { startSec: start, durationSec: dur, score };
    i = j;
  }
  return best ? { startSec: best.startSec, durationSec: best.durationSec } : null;
}

/** Adapter so captured transcripts flow into the existing audio notes & chronicle synthesis features. */
export function toAudioSessionAnalysis(capture: SessionCapture, players: CampaignPlayer[], fileName?: string): AudioSessionAnalysis {
  const names = buildSpeakerNameMap(capture, players);
  const speakers: AudioSpeaker[] = capture.speakers.map((s) => {
    const player = s.playerId ? players.find((p) => p.id === s.playerId) : undefined;
    return {
      id: s.key,
      label: player ? (player.role === "GM" ? `GM (${player.name})` : player.characterName ? `${player.name} (${player.characterName})` : player.name) : names.get(s.key) || s.key,
      role: player ? (player.role === "GM" ? "DM" : "Player") : "OOC",
      playerName: player?.name,
      characterName: player?.characterName,
      voiceCharacteristics: s.voiceDescription,
    };
  });
  return {
    transcript: formatTranscriptText(capture, players),
    speakers,
    inGameMoments: [],
    outOfCharacterMoments: [],
    processedAt: capture.processedAt || new Date().toISOString(),
    fileName: fileName || capture.recordingFileName,
    fileDuration: capture.durationSec ? formatClock(capture.durationSec) : undefined,
    sourceType: capture.method === "live" ? "live_mic" : "local_upload",
    overallAudioNotesMarkdown: `### 🎙️ Speaker-identified transcript\n**Speakers:** ${[...new Set(names.values())].join(", ")}\n**Lines:** ${capture.lines.length}${capture.durationSec ? `\n**Length:** ${formatClock(capture.durationSec)}` : ""}`,
  };
}

/** Rough serialized size, used to keep cloud session documents under Firestore's 1 MiB limit. */
export function estimateLinesBytes(lines: TranscriptLine[]): number {
  let n = 0;
  for (const l of lines) n += l.x.length + l.s.length + 32;
  return n;
}
