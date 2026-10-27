// Drives transcription of a normalized recording, one segment at a time, with progress saved after every
// segment so a long session can resume after a reload.
//
// Enrolled mode (live table): each player's enrollment clip is sent as a voiceprint and lines come back
// labeled with player ids.
// Anonymous mode (online / upload): voices come back as S1, S2, ... A short clip of each new voice is cut
// the first time it's heard and sent with later segments so numbering stays consistent across the session.

import { Campaign, CampaignPlayer, CaptureSpeaker, SessionCapture, TranscriptLine } from "../types";
import {
  fetchSegment,
  transcribeSegment,
  transcodeClip,
  suggestSpeakers,
  NormalizedManifest,
  SpeakerReferencePayload,
} from "./captureApi";
import { blobToBase64, getClip, getSegment, saveClip, saveSegment } from "./localAudioStore";
import { anonymousLabel, computeSpeakerStats, pickVoiceSample } from "./transcriptFormat";

export interface ProcessProgress {
  segmentIndex: number;
  segmentCount: number;
  stage: string;
}

export function referenceClipId(sessionId: string, key: string): string {
  return `ref_${sessionId}_${key}`;
}

function buildGlossary(campaign: Campaign): string[] {
  const words = new Set<string>();
  if (campaign.name) words.add(campaign.name);
  for (const h of campaign.heroes || []) {
    if (h.name) words.add(h.name);
    if (h.race) words.add(h.race);
  }
  for (const p of campaign.players || []) {
    if (p.name) words.add(p.name);
    if (p.characterName) words.add(p.characterName);
  }
  return [...words];
}

function playerLabel(p: CampaignPlayer): string {
  if (p.role === "GM") return `${p.name} (Game Master)`;
  return p.characterName ? `${p.name} (plays ${p.characterName})` : p.name;
}

async function enrolledReferences(players: CampaignPlayer[]): Promise<SpeakerReferencePayload[]> {
  const refs: SpeakerReferencePayload[] = [];
  for (const p of players) {
    const clip = p.enrollment ? await getClip(p.enrollment.clipId) : undefined;
    refs.push({
      key: p.id,
      label: playerLabel(p),
      role: p.role,
      characterName: p.characterName,
      description: p.learnedVoice?.description,
      audioBase64: clip?.audioBase64,
      mimeType: clip?.mimeType,
    });
  }
  return refs;
}

async function anonymousReferences(sessionId: string, speakers: CaptureSpeaker[]): Promise<SpeakerReferencePayload[]> {
  const refs: SpeakerReferencePayload[] = [];
  for (const s of speakers) {
    const clip = await getClip(referenceClipId(sessionId, s.key));
    refs.push({
      key: s.key,
      label: anonymousLabel(s.key),
      role: "Unknown",
      description: s.voiceDescription,
      audioBase64: clip?.audioBase64,
      mimeType: clip?.mimeType,
    });
  }
  return refs;
}

function transcriptTail(lines: TranscriptLine[], speakers: Map<string, string>): string {
  return lines
    .slice(-12)
    .map((l) => `${speakers.get(l.s) || l.s}: ${l.x}`)
    .join("\n");
}

async function loadSegment(jobId: string, index: number, signal?: AbortSignal): Promise<Blob> {
  const cached = await getSegment(jobId, index).catch(() => undefined);
  if (cached) return cached;
  const blob = await fetchSegment(jobId, index, signal);
  await saveSegment(jobId, index, blob).catch(() => {});
  return blob;
}

/**
 * Transcribes every remaining segment of `manifest`, calling `onUpdate` with the merged capture after each one.
 * Returns the final capture with status "needs_tagging" (unassigned speakers remain) or "complete".
 */
export async function processCapture(params: {
  sessionId: string;
  campaign: Campaign;
  capture: SessionCapture;
  jobId: string;
  manifest: NormalizedManifest;
  onUpdate: (capture: SessionCapture) => Promise<void> | void;
  onProgress?: (p: ProcessProgress) => void;
  signal?: AbortSignal;
}): Promise<SessionCapture> {
  const { sessionId, campaign, manifest, jobId, onUpdate, onProgress, signal } = params;
  const players = campaign.players || [];
  const glossary = buildGlossary(campaign);
  const segmentCount = manifest.segments.length;
  let capture: SessionCapture = {
    ...params.capture,
    jobId,
    segmentCount,
    segmentsDone: params.capture.segmentsDone || 0,
    durationSec: manifest.durationSec || params.capture.durationSec,
    status: "transcribing",
    error: undefined,
  };
  await onUpdate(capture);

  const fixedRefs = capture.diarization === "enrolled" ? await enrolledReferences(players) : [];

  for (let i = capture.segmentsDone || 0; i < segmentCount; i++) {
    if (signal?.aborted) throw new DOMException("Processing paused", "AbortError");
    const seg = manifest.segments[i];
    const segDuration = Math.max(1, seg.endSec - seg.startSec);
    onProgress?.({ segmentIndex: i, segmentCount, stage: `Fetching audio part ${i + 1} of ${segmentCount}` });
    const blob = await loadSegment(jobId, i, signal);
    const audioBase64 = await blobToBase64(blob);

    const references =
      capture.diarization === "enrolled"
        ? [...fixedRefs, ...(await anonymousReferences(sessionId, capture.speakers.filter((s) => /^U\d+$/.test(s.key))))]
        : await anonymousReferences(sessionId, capture.speakers);

    const nameMap = new Map(references.map((r) => [r.key, r.label]));
    onProgress?.({ segmentIndex: i, segmentCount, stage: `Transcribing & identifying speakers (${i + 1}/${segmentCount})` });
    const result = await transcribeSegment(
      {
        mode: capture.diarization,
        audioBase64,
        mimeType: blob.type || manifest.mimeType || "audio/mpeg",
        segmentIndex: i,
        totalSegments: segmentCount,
        segmentDurationSec: segDuration,
        references,
        priorTranscriptTail: transcriptTail(capture.lines, nameMap) || undefined,
        glossary,
        campaignName: campaign.name,
      },
      signal
    );

    const segLines: TranscriptLine[] = result.utterances.map((u) => ({
      t: Math.round((seg.startSec + u.t) * 10) / 10,
      s: u.speaker,
      x: u.text,
      ...(u.ooc ? { o: true } : {}),
    }));

    // Register new voices, keep a voice description, and cut a reference clip for anonymous continuity.
    const speakers = [...capture.speakers];
    for (const s of result.speakers) {
      let existing = speakers.find((x) => x.key === s.key);
      if (!existing) {
        existing = {
          key: s.key,
          playerId: capture.diarization === "enrolled" && players.some((p) => p.id === s.key) ? s.key : null,
        };
        speakers.push(existing);
      }
      if (s.description && !existing.voiceDescription) existing.voiceDescription = s.description;

      const isAnonymousKey = !players.some((p) => p.id === s.key);
      if (isAnonymousKey && existing.sampleStartSec === undefined) {
        const sample = pickVoiceSample(
          segLines.map((l) => ({ ...l, t: l.t - seg.startSec })),
          s.key,
          segDuration
        );
        if (sample) {
          existing.sampleStartSec = seg.startSec + sample.startSec;
          existing.sampleDurationSec = sample.durationSec;
          try {
            const clip = await transcodeClip(audioBase64, sample.startSec, sample.durationSec);
            await saveClip({ id: referenceClipId(sessionId, s.key), ...clip, createdAt: new Date().toISOString() });
          } catch {
            // Reference clips improve consistency but aren't required.
          }
        }
      }
    }
    for (const sp of speakers) {
      if (sp.playerId === undefined) sp.playerId = null;
    }

    capture = {
      ...capture,
      speakers,
      lines: [...capture.lines, ...segLines],
      segmentsDone: i + 1,
    };
    await onUpdate(capture);
  }

  const unassigned = capture.speakers.some((s) => !s.playerId && capture.lines.some((l) => l.s === s.key));
  capture = {
    ...capture,
    status: unassigned ? "needs_tagging" : "complete",
    processedAt: new Date().toISOString(),
  };
  if (unassigned && players.length > 0) {
    onProgress?.({ segmentIndex: segmentCount, segmentCount, stage: "Suggesting who's who from past sessions" });
    capture = await applySpeakerSuggestions(sessionId, capture, players).catch(() => capture);
  }
  await onUpdate(capture);
  return capture;
}

/**
 * The "remember this group" step: compares the anonymous voices with what the campaign already knows
 * (enrollment clips, voices tagged in earlier sessions, sample lines, meeting display names).
 */
export async function applySpeakerSuggestions(sessionId: string, capture: SessionCapture, players: CampaignPlayer[]): Promise<SessionCapture> {
  const stats = computeSpeakerStats(capture.lines);
  const targets = capture.speakers.filter((s) => !s.playerId && stats.has(s.key));
  if (targets.length === 0) return capture;

  // People already identified in this transcript (e.g. by voice enrollment) can't also be an unknown voice.
  const taken = new Set(capture.speakers.filter((s) => s.playerId && stats.has(s.key)).map((s) => s.playerId!));
  const candidates = players.filter((p) => !taken.has(p.id));
  if (candidates.length === 0) return capture;

  const speakerPayload = await Promise.all(
    targets.map(async (s) => {
      const clip = await getClip(referenceClipId(sessionId, s.key));
      const st = stats.get(s.key)!;
      return {
        key: s.key,
        description: s.voiceDescription,
        sampleLines: st.sampleLines,
        wordCount: st.wordCount,
        audioBase64: clip?.audioBase64,
        mimeType: clip?.mimeType,
      };
    })
  );
  const playerPayload = await Promise.all(
    candidates.map(async (p) => {
      const clipId = p.learnedVoice?.clipId || p.enrollment?.clipId;
      const clip = clipId ? await getClip(clipId) : undefined;
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        characterName: p.characterName,
        voiceDescription: p.learnedVoice?.description,
        sampleLines: p.learnedVoice?.sampleLines,
        audioBase64: clip?.audioBase64,
        mimeType: clip?.mimeType,
      };
    })
  );

  let suggestions: Array<{ key: string; playerId: string | null; confidence: number; reason: string }> = [];
  try {
    suggestions = await suggestSpeakers({
      speakers: speakerPayload,
      players: playerPayload,
      meetingParticipants: capture.bot?.participants,
    });
  } catch {
    suggestions = [];
  }

  // Offline fallback: whoever talks the most is very likely the GM.
  const gm = candidates.find((p) => p.role === "GM");
  if (suggestions.length === 0 && gm) {
    const top = [...stats.values()].filter((s) => targets.some((t) => t.key === s.key)).sort((a, b) => b.wordCount - a.wordCount)[0];
    if (top) suggestions = [{ key: top.key, playerId: gm.id, confidence: 0.4, reason: "Speaks the most (usually the GM)" }];
  }

  const speakers = capture.speakers.map((s) => {
    const sug = suggestions.find((x) => x.key === s.key);
    return sug ? { ...s, suggestedPlayerId: sug.playerId, suggestionConfidence: sug.confidence, suggestionReason: sug.reason } : s;
  });
  return { ...capture, speakers };
}

/**
 * After the GM confirms who's who, store what we learned on each player so the next upload from this group
 * gets better suggestions: a voice clip, a description, and a few things they said.
 */
export async function rememberSpeakerAssignments(sessionId: string, capture: SessionCapture, players: CampaignPlayer[]): Promise<CampaignPlayer[]> {
  const stats = computeSpeakerStats(capture.lines);
  const now = new Date().toISOString();
  const updated: CampaignPlayer[] = [];
  for (const p of players) {
    const speaker = capture.speakers.find((s) => s.playerId === p.id && s.key !== p.id);
    if (!speaker) {
      updated.push(p);
      continue;
    }
    let clipId = p.learnedVoice?.clipId;
    const refClip = await getClip(referenceClipId(sessionId, speaker.key)).catch(() => undefined);
    if (refClip) {
      clipId = `learned_${p.id}`;
      await saveClip({ ...refClip, id: clipId, createdAt: now }).catch(() => {});
    }
    const prevLines = p.learnedVoice?.sampleLines || [];
    const newLines = stats.get(speaker.key)?.sampleLines.slice(0, 4) || [];
    updated.push({
      ...p,
      learnedVoice: {
        description: speaker.voiceDescription || p.learnedVoice?.description,
        sampleLines: [...newLines, ...prevLines].slice(0, 8),
        clipId,
        confirmations: (p.learnedVoice?.confirmations || 0) + 1,
        updatedAt: now,
        meetingDisplayName: p.learnedVoice?.meetingDisplayName,
      },
    });
  }
  return updated;
}
