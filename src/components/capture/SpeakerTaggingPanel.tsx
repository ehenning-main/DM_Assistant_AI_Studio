import React, { useMemo, useRef, useState } from "react";
import { Play, Pause, Sparkles, Check, Loader2, Users } from "lucide-react";
import { CampaignPlayer, SessionCapture, TranscriptLine } from "../../types";
import { anonymousLabel, computeSpeakerStats, formatClock } from "../../services/transcriptFormat";
import { getClip, base64ToBlob } from "../../services/localAudioStore";
import { referenceClipId } from "../../services/captureProcessor";

interface Props {
  sessionId: string;
  capture: SessionCapture;
  lines: TranscriptLine[];
  players: CampaignPlayer[];
  onConfirm: (assignments: Record<string, string | null>) => Promise<void>;
  onCancel?: () => void;
  confirmLabel?: string;
}

const UNASSIGNED = "";

export function SpeakerTaggingPanel({ sessionId, capture, lines, players, onConfirm, onCancel, confirmLabel }: Props) {
  const stats = useMemo(() => computeSpeakerStats(lines), [lines]);
  const speakers = useMemo(
    () => capture.speakers.filter((s) => stats.has(s.key)).sort((a, b) => stats.get(a.key)!.firstAt - stats.get(b.key)!.firstAt),
    [capture.speakers, stats]
  );

  // Start from confirmed assignments, then confident suggestions.
  const [assign, setAssign] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    const claimed = new Set(capture.speakers.map((s) => s.playerId).filter(Boolean) as string[]);
    for (const s of capture.speakers) {
      if (s.playerId) init[s.key] = s.playerId;
      else if (s.suggestedPlayerId && (s.suggestionConfidence ?? 0) >= 0.5 && !claimed.has(s.suggestedPlayerId)) {
        init[s.key] = s.suggestedPlayerId;
        claimed.add(s.suggestedPlayerId);
      } else init[s.key] = UNASSIGNED;
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Enrolled transcripts key voices by player id; show who the recognizer thought it was.
  const label = (key: string) => {
    const p = players.find((x) => x.id === key);
    return p ? `Voice recognized as ${p.name}` : anonymousLabel(key);
  };

  const claimedBy = (playerId: string) => Object.entries(assign).find(([, v]) => v === playerId)?.[0];

  async function togglePlay(key: string) {
    if (playingKey === key) {
      audioRef.current?.pause();
      setPlayingKey(null);
      return;
    }
    const clip = await getClip(referenceClipId(sessionId, key)).catch(() => undefined);
    if (!clip) return;
    const url = URL.createObjectURL(base64ToBlob(clip.audioBase64, clip.mimeType));
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      setPlayingKey(null);
      URL.revokeObjectURL(url);
    };
    setPlayingKey(key);
    audio.play().catch(() => setPlayingKey(null));
  }

  async function confirm() {
    setSaving(true);
    try {
      const out: Record<string, string | null> = {};
      for (const s of speakers) out[s.key] = assign[s.key] || null;
      await onConfirm(out);
    } finally {
      setSaving(false);
    }
  }

  if (players.length === 0) {
    return (
      <div className="p-4 bg-amber-950/20 border border-amber-900/50 rounded-lg text-sm text-amber-200 flex gap-2">
        <Users className="w-4 h-4 mt-0.5 shrink-0" />
        Add the people at your table (Table &amp; voices) to name the speakers in this transcript.
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/60 border border-purple-900/50 rounded-lg">
      <div className="px-4 py-3 border-b border-zinc-850">
        <h3 className="font-fantasy font-bold text-sm uppercase tracking-wider text-purple-300">Who's who?</h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Match each voice to someone at your table. Your choices are remembered, so the next recording from this group gets better suggestions.
        </p>
      </div>
      <ul className="divide-y divide-zinc-850">
        {speakers.map((s) => {
          const st = stats.get(s.key)!;
          const suggested = s.suggestedPlayerId ? players.find((p) => p.id === s.suggestedPlayerId) : undefined;
          const firstLine = lines.find((l) => l.s === s.key);
          return (
            <li key={s.key} className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-zinc-100">{label(s.key)}</span>
                <span className="text-[11px] text-zinc-500 font-mono">{st.lineCount} lines · {st.wordCount} words{firstLine ? ` · first at ${formatClock(firstLine.t)}` : ""}</span>
                {s.sampleStartSec !== undefined && (
                  <button onClick={() => togglePlay(s.key)} className="ml-auto px-2 py-1 rounded border border-zinc-700 text-xs text-zinc-300 hover:border-purple-500 flex items-center gap-1 cursor-pointer" aria-label={`Play a sample of ${label(s.key)}`}>
                    {playingKey === s.key ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />} Hear voice
                  </button>
                )}
              </div>
              {s.voiceDescription && <p className="text-xs text-zinc-500 italic">{s.voiceDescription}</p>}
              <ul className="space-y-1">
                {st.sampleLines.slice(0, 3).map((line, i) => (
                  <li key={i} className="text-sm text-zinc-300 border-l-2 border-zinc-800 pl-2 line-clamp-2">“{line}”</li>
                ))}
              </ul>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={assign[s.key] || UNASSIGNED}
                  onChange={(e) => setAssign((prev) => {
                    const next = { ...prev };
                    // One person per voice: picking someone already used frees their previous voice.
                    for (const k of Object.keys(next)) if (e.target.value && next[k] === e.target.value) next[k] = UNASSIGNED;
                    next[s.key] = e.target.value;
                    return next;
                  })}
                  className="flex-1 min-w-[180px] bg-zinc-950 border border-zinc-700 rounded px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
                  aria-label={`Assign ${label(s.key)}`}
                >
                  <option value={UNASSIGNED}>Leave as {label(s.key)}</option>
                  {players.map((p) => {
                    const owner = claimedBy(p.id);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.role === "GM" ? `GM (${p.name})` : p.characterName ? `${p.name} · ${p.characterName}` : p.name}
                        {owner && owner !== s.key ? ` (now ${label(owner)})` : ""}
                      </option>
                    );
                  })}
                </select>
                {suggested && (
                  <span className="text-[11px] text-purple-300 flex items-center gap-1" title={s.suggestionReason}>
                    <Sparkles className="w-3 h-3" /> Suggested: {suggested.name} ({Math.round((s.suggestionConfidence || 0) * 100)}%)
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="p-4 border-t border-zinc-850 flex gap-2 justify-end">
        {onCancel && (
          <button onClick={onCancel} className="px-4 py-2.5 rounded border border-zinc-700 text-sm text-zinc-300 cursor-pointer">Cancel</button>
        )}
        <button onClick={confirm} disabled={saving} className="px-4 py-2.5 rounded bg-purple-500 hover:bg-purple-400 text-zinc-950 font-bold text-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {confirmLabel || "Apply names"}
        </button>
      </div>
    </div>
  );
}
